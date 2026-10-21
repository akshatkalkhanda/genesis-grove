import { World } from './simulation.js';
import { SaveLibrary, indexed_backend, AutosaveClock, LEGACY_SAVE_KEY } from './save_store.js';

export function create_save_ui({ get_world, is_started, replace, after_load, pause, is_paused, notify }) {
    const $ = id => document.getElementById(id);
    const library = new SaveLibrary(indexed_backend());
    const clock = new AutosaveClock();
    let world_id = crypto.randomUUID(), active_slot = null, busy = false, transitioning = false;
    let storage_ready = false, last_marker = null, confirming_remove = null, error_reported = false;
    const describe_error = error => error?.name === 'QuotaExceededError'
        ? 'Device storage is full. Export a world or remove an unwanted saved copy.'
        : error?.message || 'Device storage is unavailable. Export your world to a file.';
    const status = (text, error = false) => {
        $('save-status').textContent = text; $('save-status').classList.toggle('save-error', error);
        $('save').title = text;
    };
    const marker = () => world_id + JSON.stringify(get_world().serialize());
    const ready = (async () => {
        let legacy;
        try { legacy = localStorage.getItem(LEGACY_SAVE_KEY); } catch { /* IndexedDB may still work. */ }
        if (legacy) {
            try {
                const old = JSON.parse(legacy), checked = World.deserialize(old.world);
                await library.migrate(checked.serialize(), old.saved_at);
            } catch (error) { status(`Older save retained: ${describe_error(error)}`, true); }
        }
        try { clock.interval = await library.interval(); storage_ready = true; }
        catch (error) { status(describe_error(error), true); }
        $('autosave-interval').value = String(clock.interval);
    })();
    async function write(reason, { id = null, name = get_world().name, preserve_id = null } = {}) {
        const snapshot = get_world().serialize(), captured_id = world_id, captured_marker = marker();
        const record = await library.write(snapshot, { id, name, world_id: captured_id, slot_id: active_slot, reason, preserve_id });
        storage_ready = true; error_reported = false;
        if (captured_id === world_id) {
            last_marker = captured_marker;
            const time = new Date(record.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            status(`${reason === 'manual' ? 'Saved' : reason === 'auto' ? 'Recovery saved' : 'Recovery protected'} · ${time}`);
        }
        return record;
    }
    async function transition(next, { reason = 'before-load', record = null } = {}) {
        if (transitioning || busy) { notify('A save operation is still finishing. Try again in a moment.'); return false; }
        transitioning = true;
        const was_paused = is_paused(); pause(true);
        try {
            await ready;
            if (is_started()) await write(reason, { preserve_id: record?.id });
            if (record) await library.mark_current(record.id);
            const candidate = record?.type === 'manual' ? record.id : record?.slot_id;
            const named = candidate ? await library.get(candidate) : null;
            replace(next);
            world_id = record?.world_id || crypto.randomUUID();
            active_slot = named?.type === 'manual' && named.world_id === world_id ? named.id : null;
            last_marker = record ? marker() : null;
            clock.reset(performance.now()); pause(was_paused);
            status(record ? `Restored · ${record.name}` : 'New world · not saved yet');
            return true;
        } catch (error) {
            status('Recovery failed · current world kept', true);
            notify(`${describe_error(error)} The current world has not been replaced.`);
            return false;
        } finally { transitioning = false; pause(was_paused); }
    }
    async function load_record(record) {
        if (!record) { notify('No saved copy is available yet.'); return; }
        try {
            const next = World.deserialize(record.world); // Validate before making any state or recovery changes.
            if (await transition(next, { record })) {
                $('load-dialog').close(); after_load(); notify(`Restored ${record.name}.`);
            }
        } catch { notify('That copy could not be read. Your current world is unchanged; try a recovery copy.'); }
    }
    function save_row(record) {
        const row = document.createElement('article'); row.className = 'world-save';
        row.dataset.saveId = record.id; row.dataset.saveType = record.type;
        const heading = document.createElement('strong'); heading.textContent = record.name || 'Unnamed copy';
        const detail = document.createElement('p');
        const reasons = { auto: 'Automatic recovery', 'before-new': 'Before a new world', 'before-load': 'Before loading another world', 'before-import': 'Before importing a world' };
        detail.textContent = `Year ${Math.floor((record.world?.time || 0) / (record.world?.year_length || 20)) + 1} · ${new Date(record.saved_at).toLocaleString()}${record.type === 'recovery' ? ` · ${reasons[record.reason] || 'Recovery'}` : ''}`;
        const actions = document.createElement('div'); actions.className = 'save-row-actions';
        const load = document.createElement('button'); load.textContent = 'Load'; load.dataset.action = 'load-copy';
        load.onclick = () => load_record(record);
        const remove = document.createElement('button'); remove.dataset.action = 'remove-copy';
        remove.textContent = confirming_remove === record.id ? 'Remove permanently' : 'Remove copy';
        remove.onclick = async () => {
            if (confirming_remove !== record.id) { confirming_remove = record.id; await render_library(); return; }
            try {
                await library.remove(record.id);
                if (active_slot === record.id) { active_slot = null; status('Named save removed · save a new copy'); }
                if (record.world_id === world_id) last_marker = null;
                confirming_remove = null; await render_library();
                notify('Saved copy removed. The world on screen is unchanged.');
            } catch (error) { notify(describe_error(error)); }
        };
        actions.append(load, remove);
        if (confirming_remove === record.id) {
            const cancel = document.createElement('button'); cancel.textContent = 'Cancel removal';
            cancel.onclick = () => { confirming_remove = null; render_library(); };
            actions.append(cancel);
        }
        row.append(heading, detail, actions); return row;
    }
    async function render_library() {
        try {
            const [records, latest] = await Promise.all([library.list(), library.latest()]);
            $('saved-worlds-list').replaceChildren(...records.filter(r => r.type === 'manual').map(save_row));
            $('recovery-list').replaceChildren(...records.filter(r => r.type === 'recovery').map(save_row));
            if (!$('saved-worlds-list').childElementCount) $('saved-worlds-list').textContent = 'No named saves yet. Use Save to keep a world.';
            if (!$('recovery-list').childElementCount) $('recovery-list').textContent = 'Recovery copies appear after autosave or before replacing a world.';
            $('saved-world').textContent = `${records.filter(r => r.type === 'manual').length} / 12 named saves · ${records.filter(r => r.type === 'recovery').length} / 6 recovery copies`;
            $('restore').disabled = !latest;
            $('restore').textContent = latest ? `Continue ${latest.name}` : 'No saved world yet';
        } catch (error) { $('saved-world').textContent = describe_error(error); $('restore').disabled = true; }
    }
    $('load').onclick = async () => {
        $('load-dialog').showModal(); $('saved-world').textContent = 'Reading saved worlds…';
        await ready; await render_library();
    };
    $('restore').onclick = async () => { try { await load_record(await library.latest()); } catch (error) { notify(describe_error(error)); } };
    $('save').onclick = async () => {
        await ready;
        const old = active_slot ? await library.get(active_slot).catch(() => null) : null;
        $('slot-name').value = old?.name || get_world().name;
        $('save-mode').replaceChildren();
        for (const [value, text] of [...(old ? [['update', `Update ${old.name}`]] : []), ['new', 'Create a new named save']]) {
            const option = document.createElement('option'); option.value = value; option.textContent = text; $('save-mode').append(option);
        }
        $('save-error').textContent = ''; $('save-dialog').showModal(); $('slot-name').focus();
    };
    $('save-form').onsubmit = async event => {
        event.preventDefault(); if (busy || transitioning) return;
        busy = true; $('commit-save').disabled = true; status('Saving…');
        try {
            const record = await write('manual', { id: $('save-mode').value === 'update' ? active_slot : null, name: $('slot-name').value });
            active_slot = record.id; $('save-dialog').close(); notify(`Saved ${record.name}.`);
        } catch (error) { $('save-error').textContent = describe_error(error); status('Save failed · earlier copies kept', true); }
        finally { busy = false; $('commit-save').disabled = false; }
    };
    $('autosave-interval').onchange = async event => {
        const requested = Number(event.target.value), previous = clock.interval;
        try {
            await library.set_interval(requested); clock.interval = requested; clock.reset(performance.now()); storage_ready = true;
            status(requested ? 'Automatic recovery enabled' : 'Automatic recovery off');
        } catch (error) { event.target.value = String(previous); notify(describe_error(error)); }
    };
    $('import').onchange = async event => {
        const file = event.target.files[0]; if (!file) return;
        try {
            if (file.size > 8_000_000) throw new Error('World files must be smaller than 8 MB.');
            const next = World.deserialize(JSON.parse(await file.text()));
            if (await transition(next, { reason: 'before-import' })) { $('load-dialog').close(); after_load(); notify('Your world has arrived.'); }
        } catch (error) { notify(error instanceof SyntaxError ? 'That file is not valid JSON. The current world is unchanged.' : describe_error(error)); }
        event.target.value = '';
    };
    $('export').onclick = () => {
        const world = get_world(), blob = new Blob([JSON.stringify(world.serialize())], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
        link.download = `${world.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'world'}-year-${world.year}.json`;
        link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); notify('World exported. Keep the file outside the app for a separate backup.');
    };
    document.addEventListener('visibilitychange', () => clock.reset(performance.now()));
    return {
        ready, transition,
        async continue() { await ready; try { await load_record(await library.latest()); } catch (error) { notify(describe_error(error)); } },
        async has_saved() { await ready; try { return Boolean(await library.latest()); } catch { return false; } },
        frame(now, active) {
            if (!clock.due(now, active && storage_ready && !busy && !transitioning)) return;
            if (last_marker === marker()) return;
            busy = true;
            write('auto').catch(error => {
                status('Recovery save failed · earlier copies kept', true);
                if (!error_reported) { notify(describe_error(error)); error_reported = true; }
            }).finally(() => { busy = false; });
        }
    };
}
