import test from 'node:test';
import assert from 'node:assert/strict';
import { World, WIDTH } from '../src/simulation.js';

test('history preserves event locations in saves and accepts legacy events', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    world.apply('grass', 40, 40, 8);
    world.apply('human', 40, 40, 1);
    const founded = world.events.find(event => event.kind === 'village');
    assert.equal(founded.x, world.villages[0].x);
    world.apply('meteor', 70, 50, 2);
    assert.equal(world.events[0].x, 70);
    assert.equal(world.events[0].y, 50);
    assert.deepEqual(World.deserialize(world.serialize()).events, world.events);
    const legacy = world.serialize();
    for (const event of legacy.events) { delete event.x; delete event.y; }
    assert.deepEqual(World.deserialize(legacy).events, legacy.events);
});

test('history retention is bounded and milestone events survive ordinary traffic', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    world.log('Year 100: a milestone', 'creation');
    for (let i = 0; i < 250; i++) world.log(`Event ${i}`, 'life', { x: 3, y: 4 });
    assert.equal(world.events.length, 200);
    assert.ok(world.events.some(event => event.text.startsWith('Year 100:')));
    assert.equal(World.deserialize(world.serialize()).events.length, 200);
});

test('invalid event locations are rejected when importing a world', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    for (const location of [{ x: WIDTH, y: 3 }, { x: 3 }, { x: '3', y: 4 }, { x: 3, y: -1 }]) {
        const data = world.serialize(); Object.assign(data.events[0], location);
        assert.throws(() => World.deserialize(data));
    }
});
