import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, WIDTH, HEIGHT } from '../src/simulation.js';
const blank = () => new World({ preset: 'empty', inhabited: false });
test('same seed gives identical terrain, settlements and deterministic evolution', () => {
    const a = new World({ seed: 'known world' }), b = new World({ seed: 'known world' });
    assert.deepEqual(a.serialize(), b.serialize());
    for (let i = 0; i < 120; i++) { a.step(0.125); b.step(0.125); }
    assert.deepEqual(a.serialize(), b.serialize());
    assert.notDeepEqual(a.tiles, new World({ seed: 'different world' }).tiles);
});
test('default world has viable civilizations that build and grow without intervention', () => {
    const w = new World();
    const initial = w.stats();
    assert.equal(initial.villages, 3);
    assert.ok(initial.population > 0);
    assert.ok(initial.land > 20 && initial.land < 80);
    for (let i = 0; i < 2400; i++) w.step(0.125);
    assert.ok(w.people.length > initial.population);
    assert.ok(w.villages.every(v => v.houses.length > 1));
    assert.ok(w.people.every(p => w.walkable(p.x, p.y)));
    assert.equal(w.year, 16);
});
test('terrain tools honor bounds, circular brush and walkability', () => {
    const w = blank();
    w.apply('grass', 0, 0, 2);
    assert.equal(w.tile(0, 0), T.GRASS);
    assert.equal(w.tile(2, 2), T.OCEAN);
    assert.equal(w.tiles.length, WIDTH * HEIGHT);
    w.apply('mountain', 0, 0, 1);
    assert.equal(w.walkable(0, 0), false);
    w.apply('grass', -100, -100, 12);
    assert.equal(w.tiles.length, WIDTH * HEIGHT);
});
test('life requires land; flooding removes inhabitants and retires their village', () => {
    const w = blank();
    w.apply('human', 20, 20, 4);
    assert.equal(w.people.length, 0);
    w.apply('grass', 20, 20, 10);
    w.apply('human', 20, 20, 4);
    assert.equal(w.people.length, 3);
    assert.equal(w.stats().villages, 1);
    w.apply('ocean', 20, 20, 12);
    assert.equal(w.people.length, 0);
    assert.equal(w.stats().villages, 0);
});
test('rain quenches fire and restores burned land; meteor damages units and terrain', () => {
    const w = blank();
    w.apply('forest', 30, 30, 10);
    w.apply('fire', 30, 30, 3);
    assert.ok(w.fire[w.index(30, 30)] > 0);
    w.apply('rain', 30, 30, 4);
    assert.equal(w.fire[w.index(30, 30)], 0);
    w.apply('human', 30, 30, 1);
    w.apply('meteor', 30, 30, 4);
    assert.equal(w.people.length, 0);
    assert.equal(w.tile(30, 30), T.LAVA);
    w.apply('rain', 30, 30, 5);
    assert.equal(w.tile(30, 30), T.ASH);
    w.apply('rain', 30, 30, 5);
    assert.equal(w.tile(30, 30), T.GRASS);
});
test('fire spreads to vegetation and burns out', () => {
    const w = blank();
    w.apply('forest', 40, 40, 10);
    w.apply('fire', 40, 40, 2);
    for (let i = 0; i < 2500; i++) w.step(0.125);
    assert.ok(w.tiles.some(t => t === T.ASH));
    assert.ok(w.fire.every(f => f <= 0));
});
test('blessing heals and eraser removes life without changing terrain', () => {
    const w = blank(); w.apply('grass', 40, 40, 10); w.apply('human', 40, 40, 1);
    w.people[0].health = 20; w.apply('bless', 40, 40, 5);
    assert.equal(w.people[0].health, 100);
    w.apply('erase', 40, 40, 8);
    assert.equal(w.people.length, 0); assert.equal(w.tile(40, 40), T.GRASS);
});
test('save roundtrip preserves simulation, random state and independent arrays', () => {
    const w = new World(); w.apply('fire', 70, 50, 3);
    for (let i = 0; i < 200; i++) w.step(0.125);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
    assert.deepEqual(loaded.serialize(), w.serialize());
    for (let i = 0; i < 100; i++) { loaded.step(0.125); w.step(0.125); }
    assert.deepEqual(loaded.serialize(), w.serialize());
    loaded.tiles[0] = T.MOUNTAIN; assert.notEqual(loaded.tiles[0], w.tiles[0]);
});
test('corrupt and untrusted saves are rejected before replacing a world', () => {
    const original = new World().serialize();
    const mutations = [
        d => { d.version = 99; }, d => { d.tiles.pop(); }, d => { d.tiles[0] = 200; },
        d => { d.fire[0] = Infinity; }, d => { d.people[0].x = -1; },
        d => { d.people[0].village_id = 99999; }, d => { d.people[0].id = d.villages[0].id; },
        d => { d.villages[0].houses = [{ x: NaN, y: 0 }]; }, d => { d.name = 'x'.repeat(1000); },
        d => { d.animals[0].species = 'dragon'; }, d => { d.rng = 0; }
    ];
    for (const mutate of mutations) { const d = structuredClone(original); mutate(d); assert.throws(() => World.deserialize(d), /valid Genesis/); }
    assert.throws(() => World.deserialize(null));
    assert.throws(() => World.deserialize({}));
});
test('world populations remain bounded during repeated spawning', () => {
    const w = blank(); w.apply('grass', 50, 50, 12);
    for (let i = 0; i < 700; i++) { w.apply('human', 50, 50, 1); w.apply('sheep', 50, 50, 1); }
    assert.equal(w.people.length, 600); assert.equal(w.animals.length, 350);
});
