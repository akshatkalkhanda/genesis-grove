import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveLibrary, AutosaveClock, MAX_MANUAL_SAVES } from '../src/save_store.js';
import { World } from '../src/simulation.js';

class MemoryStore {
    constructor() { this.records = []; this.fail = false; }
    async read() { return structuredClone(this.records); }
    async change(fn) {
        const plan = fn(structuredClone(this.records));
        if (this.fail) throw new Error('Quota exceeded');
        const next = this.records.filter(r => !plan.remove?.includes(r.id));
        for (const record of plan.put || []) {
            const i = next.findIndex(r => r.id === record.id);
            if (i >= 0) next.splice(i, 1);
            next.push(structuredClone(record));
        }
        this.records = next;
        return plan.result;
    }
}
function setup() {
    const backend = new MemoryStore(); let sequence = 0;
    return { backend, library: new SaveLibrary(backend, {
        id: () => `copy-${++sequence}`, clock: () => new Date(1800000000000 + sequence * 1000).toISOString()
    }), world: new World({ preset: 'empty', inhabited: false }).serialize() };
}

test('named slots keep independent worlds; updating a slot is explicit and preserves the other slot', async () => {
    const { library, world } = setup();
    const first = await library.write(world, { name: 'First', world_id: 'a' });
    const second = await library.write(world, { name: 'Second', world_id: 'b' });
    world.name = 'Changed';
    await library.write(world, { id: first.id, name: 'Updated', world_id: 'a' });
    assert.equal((await library.get(second.id)).world.name, 'The Emerald Isles');
    assert.equal((await library.get(first.id)).world.name, 'Changed');
    await assert.rejects(library.write(world, { id: first.id, world_id: 'b' }), /belong/);
});

test('recovery is bounded per world and globally without evicting manual slots', async () => {
    const { library, world } = setup();
    const manual = await library.write(world, { world_id: 'a' });
    for (let i = 0; i < 8; i++) await library.write(world, { world_id: 'a', reason: 'auto' });
    assert.equal((await library.list()).filter(r => r.type === 'recovery').length, 3);
    for (const world_id of ['b', 'c', 'd', 'e', 'f']) await library.write(world, { world_id, reason: 'before-new' });
    assert.equal((await library.list()).filter(r => r.type === 'recovery').length, 6);
    assert.ok(await library.get(manual.id));
});

test('pre-replacement copies do not steal Continue; explicitly loading a recovery does', async () => {
    const { library, world } = setup();
    const named = await library.write(world, { world_id: 'a' });
    const backup = await library.write(world, { world_id: 'a', reason: 'before-import' });
    assert.equal((await library.latest()).id, named.id);
    await library.mark_current(backup.id);
    assert.equal((await library.latest()).id, backup.id);
});

test('loading the oldest recovery at capacity retains both destination and pre-load protection', async () => {
    for (const same_world of [true, false]) {
        const { library, world } = setup();
        const oldest = await library.write(world, { world_id: 'a', reason: 'auto' });
        for (let i = 0; i < (same_world ? 2 : 5); i++) {
            await library.write(world, { world_id: same_world ? 'a' : `other-${i}`, reason: 'auto' });
        }
        const protection = await library.write(world, {
            world_id: 'a', reason: 'before-load', preserve_id: oldest.id
        });
        assert.ok(await library.get(oldest.id));
        assert.ok(await library.get(protection.id));
        assert.equal((await library.list()).length, same_world ? 3 : 6);
        await library.mark_current(oldest.id);
        assert.equal((await library.latest()).id, oldest.id);
    }
});

test('a failed write/prune leaves every prior copy intact and later saves can recover', async () => {
    const { backend, library, world } = setup();
    const old = await library.write(world, { world_id: 'a' });
    backend.fail = true;
    await assert.rejects(library.write(world, { id: old.id, name: 'Replacement', world_id: 'a' }), /Quota/);
    assert.equal((await library.get(old.id)).name, 'The Emerald Isles');
    backend.fail = false;
    assert.ok(await library.write(world, { world_id: 'a', reason: 'auto' }));
});

test('manual capacity requires an explicit removal; automatic recovery cannot overwrite named slots', async () => {
    const { library, world } = setup();
    for (let i = 0; i < MAX_MANUAL_SAVES; i++) await library.write(world, { world_id: 'a' });
    await assert.rejects(library.write(world, { world_id: 'a' }), /12 save slots/);
    const first = (await library.list())[0];
    await library.remove(first.id);
    assert.ok(await library.write(world, { world_id: 'b' }));
    await assert.rejects(library.write(world, { id: first.id, world_id: 'a', reason: 'auto' }));
});

test('legacy import is preserved once and never resurrects a copy intentionally removed later', async () => {
    const { library, world } = setup();
    assert.equal(await library.migrate(world, '2026-10-21T10:00:00Z'), true);
    assert.equal((await library.list()).length, 1);
    await library.remove('legacy-device-save');
    assert.equal(await library.migrate(world), false);
    assert.equal((await library.list()).length, 0);
});

test('concurrent saves serialize, snapshot data is copied and invalid settings/names are rejected', async () => {
    const { library, world } = setup();
    const writes = Array.from({ length: 10 }, () => library.write(world, { world_id: 'a', reason: 'auto' }));
    world.name = 'Changed after capture';
    await Promise.all(writes);
    assert.equal((await library.list()).length, 3);
    assert.notEqual((await library.list())[0].world.name, world.name);
    assert.equal(await library.interval(), 60);
    await library.set_interval(30); assert.equal(await library.interval(), 30);
    await assert.rejects(library.set_interval(1));
    await assert.rejects(library.write(world, { name: ' ', world_id: 'a' }));
});

test('autosave clock uses visible real time, never catches up after hidden/modal time, and supports off', () => {
    const clock = new AutosaveClock(60);
    assert.equal(clock.due(0, true), false);
    assert.equal(clock.due(59999, true), false);
    assert.equal(clock.due(60000, true), true);
    assert.equal(clock.due(180000, false), false);
    assert.equal(clock.due(180001, true), false);
    assert.equal(clock.due(240000, true), true);
    clock.interval = 0; assert.equal(clock.due(900000, true), false);
});
