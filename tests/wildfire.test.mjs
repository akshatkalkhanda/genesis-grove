import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_fire, MAX_FIRE_SPREAD } from '../src/wildfire.js';

function forest() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'lightning-locality-2026' });
    world.tiles.fill(T.FOREST);
    return world;
}

test('one lightning strike stays local through a continuous forest and burns out', () => {
    const world = forest(), affected = new Set();
    world.apply('lightning', 96, 64, 12);
    assert.equal(world.fire.filter(f => f > 0).length, 13);
    for (let t = 0; t < 600; t += 0.125) {
        for (let i = 0; i < world.fire.length; i++) if (world.fire[i] > 0) affected.add(i);
        advance_fire(world, 0.125);
    }
    assert.ok(affected.size > 13, 'nearby vegetation can catch fire');
    assert.ok(affected.size <= 145, 'the radius-eight diamond has at most 145 tiles');
    for (const i of affected) assert.ok(Math.abs(i % world.width - 96)
        + Math.abs(Math.floor(i / world.width) - 64) <= MAX_FIRE_SPREAD + 2);
    assert.ok(world.fire.every(f => f === 0));
    assert.equal(world.tile(120, 64), T.FOREST);
});

test('lightning damage stays near the strike even with the largest brush', () => {
    const world = forest(), kingdom = world.found_village(96, 64);
    world.add_person(96, 64, kingdom.id); world.add_person(106, 64, kingdom.id);
    const [near, far] = world.people;
    world.apply('lightning', 96, 64, 12);
    assert.equal(near.health, 25);
    assert.equal(far.health, 100);
});

test('water and snow break the fire front; rain leaves no lingering heat', () => {
    for (const barrier of [T.OCEAN, T.SNOW]) {
        const world = forest();
        for (let y = 0; y < 128; y++) world.set_tile(98, y, barrier);
        world.apply('fire', 96, 64, 1);
        for (let t = 0; t < 120; t += 0.125) advance_fire(world, 0.125);
        assert.equal(world.tile(99, 64), T.FOREST);
        world.apply('fire', 110, 64, 1); world.apply('rain', 110, 64, 4);
        advance_fire(world, 0.125);
        assert.equal(world.fire[world.index(110, 64)], 0);
        assert.equal(world.fire_spread[world.index(110, 64)], -1);
    }
});

test('spread limits persist exactly across save/load and older fires get bounded defaults', () => {
    const world = forest(); world.apply('lightning', 96, 64, 2);
    for (let n = 0; n < 40; n++) world.step(0.125);
    const restored = World.deserialize(world.serialize());
    for (let n = 0; n < 320; n++) { world.step(0.125); restored.step(0.125); }
    assert.deepEqual(restored.serialize(), world.serialize());
    const legacy = forest().serialize(); delete legacy.fire_spread;
    legacy.fire[100] = 12;
    const old = World.deserialize(legacy); advance_fire(old, 0.125);
    assert.equal(old.fire_spread[100], MAX_FIRE_SPREAD);
    for (const value of [-2, MAX_FIRE_SPREAD + 1, 1.5, Infinity]) {
        const bad = world.serialize(); bad.fire_spread[0] = value;
        assert.throws(() => World.deserialize(bad));
    }
    const short = world.serialize(); short.fire_spread.pop();
    assert.throws(() => World.deserialize(short));
});
