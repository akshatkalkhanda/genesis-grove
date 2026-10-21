export const LEGACY_SAVE_KEY = 'genesis-grove-world-v1';
export const SAVE_DATABASE = 'genesis-grove-library-v1';
export const MAX_MANUAL_SAVES = 12;
export const MAX_RECOVERY_SAVES = 6;
export const MAX_WORLD_RECOVERY = 3;
export const AUTOSAVE_INTERVALS = [0, 30, 60, 300];
const CONTINUE_ID = 'meta:continue';
const SETTINGS_ID = 'meta:settings';
const MIGRATED_ID = 'meta:legacy-migrated';

function sorted(records) {
    return records.filter(r => r && ['manual', 'recovery'].includes(r.type)
        && typeof r.id === 'string' && typeof r.saved_at === 'string')
        .sort((a, b) => b.saved_at.localeCompare(a.saved_at) || b.id.localeCompare(a.id));
}

// Run read/modify/write in one transaction, so quota/write failures keep the old records intact.
export function indexed_backend(provider = globalThis.indexedDB) {
    let opening;
    const open = () => {
        if (opening) return opening;
        opening = new Promise((resolve, reject) => {
            if (!provider) { reject(new Error('Device storage is unavailable. Export your world to a file.')); return; }
            let ended = false;
            const request = provider.open(SAVE_DATABASE, 1);
            const fail = error => { if (!ended) { ended = true; reject(error); } };
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' });
            };
            request.onerror = () => fail(request.error || new Error('Device storage could not be opened.'));
            request.onblocked = () => fail(new Error('Close other Genesis Grove windows and try again.'));
            request.onsuccess = () => {
                if (ended) { request.result.close(); return; }
                ended = true;
                request.result.onversionchange = () => { request.result.close(); opening = null; };
                resolve(request.result);
            };
        }).catch(error => { opening = null; throw error; });
        return opening;
    };
    return {
        async read() {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('records', 'readonly'), request = tx.objectStore('records').getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                tx.onabort = () => reject(tx.error || new Error('Reading saved worlds failed.'));
            });
        },
        async change(make_change) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records');
                let result, problem;
                tx.oncomplete = () => resolve(result);
                tx.onabort = () => reject(problem || tx.error || new Error('Saving failed. Existing copies are unchanged.'));
                tx.onerror = () => {}; // The abort handler owns error reporting.
                const request = store.getAll();
                request.onsuccess = () => {
                    try {
                        const plan = make_change(request.result); result = plan.result;
                        for (const id of plan.remove || []) store.delete(id);
                        for (const record of plan.put || []) store.put(record);
                    } catch (error) { problem = error; tx.abort(); }
                };
            });
        }
    };
}

export class SaveLibrary {
    constructor(backend, { clock = () => new Date().toISOString(), id = () => crypto.randomUUID() } = {}) {
        this.backend = backend; this.clock = clock; this.id = id; this.pending = Promise.resolve();
    }
    change(make_change) {
        const job = this.pending.then(() => this.backend.change(make_change));
        this.pending = job.catch(() => {});
        return job;
    }
    async list() { await this.pending; return sorted(await this.backend.read()); }
    async get(id) { return (await this.list()).find(r => r.id === id) || null; }
    async latest() {
        await this.pending;
        const records = await this.backend.read(), list = sorted(records);
        return list.find(r => r.id === records.find(r => r.id === CONTINUE_ID)?.target) || list[0] || null;
    }
    async interval() {
        await this.pending;
        const value = (await this.backend.read()).find(r => r.id === SETTINGS_ID)?.interval;
        return AUTOSAVE_INTERVALS.includes(value) ? value : 60;
    }
    set_interval(interval) {
        if (!AUTOSAVE_INTERVALS.includes(interval)) return Promise.reject(new Error('Choose a supported autosave interval.'));
        return this.change(() => ({ put: [{ id: SETTINGS_ID, type: 'meta', interval }], result: interval }));
    }
    mark_current(id) {
        return this.change(records => {
            if (!sorted(records).some(r => r.id === id)) throw new Error('That save is no longer available.');
            return { put: [{ id: CONTINUE_ID, type: 'meta', target: id }] };
        });
    }
    async write(world, { id = null, name = world.name, world_id, slot_id = null, reason = 'manual', preserve_id = null } = {}) {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 60) throw new Error('Use a save name between 1 and 60 characters.');
        if (typeof world_id !== 'string' || !world_id || world_id.length > 100) throw new Error('The world identity is invalid.');
        if (!['manual', 'auto', 'before-new', 'before-load', 'before-import'].includes(reason)) throw new Error('Invalid recovery reason.');
        const saved_at = this.clock(), type = reason === 'manual' ? 'manual' : 'recovery';
        const record = { id: id || this.id(), type, name: name.trim(), world_id, slot_id,
            reason, saved_at, world: structuredClone(world) };
        // Bound individual records before asking the browser to persist them.
        if (new TextEncoder().encode(JSON.stringify(record)).length > 8_500_000) throw new Error('This world is too large for a device slot. Export it instead.');
        return this.change(records => {
            const old = records.find(r => r.id === record.id);
            if (id && (!old || old.type !== 'manual' || type !== 'manual' || old.world_id !== world_id)) throw new Error('That save does not belong to the current world. Create a new slot.');
            if (type === 'manual' && !old && records.filter(r => r.type === 'manual').length >= MAX_MANUAL_SAVES) throw new Error('All 12 save slots are in use. Export and remove a slot before adding another.');
            if (!id && old) throw new Error('A save identity collided. Try saving again.');
            // Loading an older recovery must not rotate away that destination while protecting the current map.
            const selected = records.find(r => r.id === preserve_id && r.type === 'recovery');
            const recovery = [...(type === 'recovery' ? [record] : []), ...(selected ? [selected] : []),
                ...sorted(records.filter(r => r.id !== record.id && r.id !== selected?.id)).filter(r => r.type === 'recovery')];
            const counts = new Map(), keep = [];
            for (const item of recovery) {
                const count = counts.get(item.world_id) || 0;
                if (count < MAX_WORLD_RECOVERY && keep.length < MAX_RECOVERY_SAVES) {
                    keep.push(item.id); counts.set(item.world_id, count + 1);
                }
            }
            const remove = recovery.filter(r => !keep.includes(r.id)).map(r => r.id);
            const put = [record];
            if (reason === 'manual' || reason === 'auto') put.push({ id: CONTINUE_ID, type: 'meta', target: record.id });
            return { put, remove, result: record };
        });
    }
    remove(id) {
        return this.change(records => {
            const record = sorted(records).find(r => r.id === id);
            if (!record) throw new Error('That saved copy is no longer available.');
            return { remove: [id] };
        });
    }
    migrate(world, saved_at) {
        return this.change(records => {
            if (records.some(r => r.id === MIGRATED_ID)) return { result: false };
            if (records.filter(r => r.type === 'manual').length >= MAX_MANUAL_SAVES) throw new Error('Free a save slot to import the older device save.');
            const record = { id: 'legacy-device-save', world_id: 'legacy-world', name: world.name,
                type: 'manual', slot_id: null, reason: 'manual', saved_at: typeof saved_at === 'string' && !Number.isNaN(Date.parse(saved_at)) ? saved_at : this.clock(), world: structuredClone(world) };
            return { put: [record, { id: MIGRATED_ID, type: 'meta' }], result: true };
        });
    }
}

// Real visible time, independent of simulation speed. Returning from hidden/modal time starts a fresh interval.
export class AutosaveClock {
    constructor(interval = 60) { this.interval = interval; this.deadline = null; }
    reset(now) { this.deadline = now + this.interval * 1000; }
    due(now, active) {
        if (!active || !this.interval) { this.reset(now); return false; }
        if (this.deadline === null) this.reset(now);
        if (now < this.deadline) return false;
        this.reset(now); return true;
    }
}
