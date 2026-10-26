import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_forestry, FORESTRY, harvest_tree, is_tree_site, tree_clearings } from '../src/forestry.js';
import { GameAudio, SOUND_PROFILES } from '../src/game_audio.js';

function forest_world() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'forest-regrowth' });
    world.tiles.fill(T.GRASS);
    world.roads.fill(0);
    world.tiles[world.index(51, 50)] = T.FOREST;
    world.fertility[world.index(51, 50)] = 0.1;
    return world;
}

test('harvest is finite, shared by workers, and only credits wood actually removed', () => {
    const world = forest_world();
    assert.equal(is_tree_site(world, 51, 50), true);
    const first = harvest_tree(world, 51, 50, 1.25);
    const second = harvest_tree(world, 51, 50, 10);
    const third = harvest_tree(world, 51, 50, 10);
    assert.equal(first, 1.25);
    assert.ok(Math.abs(second - 0.75) < 1e-6);
    assert.equal(third, 0);
    assert.ok(Math.abs(first + second - 2) < 1e-6);
    assert.equal(world.fertility[world.index(51, 50)], 0);
    assert.equal(world.tile(51, 50), T.GRASS);
    assert.equal(world.stumps.size, 1);
    assert.deepEqual(world.effects.map(effect => effect.type), ['tree_chop', 'tree_fall']);
});

test('mature tree anchors match artwork, excluding clearings and adjacent roads', () => {
    const world = forest_world();
    assert.equal(is_tree_site(world, 50, 50), false);
    assert.equal(is_tree_site(world, 51, 51), false);
    assert.equal(is_tree_site(world, 51, 50), true);
    const clearing = tree_clearings(world);
    assert.equal(clearing[world.index(51, 50)], 0);
    world.roads[world.index(52, 50)] = 1;
    assert.equal(is_tree_site(world, 51, 50), false);
    const home = world.found_village(53, 50);
    assert.equal(is_tree_site(world, 51, 50), false);
    assert.ok(home);
});

test('an exhausted legacy tree is felled on a work visit without producing duplicate timber', () => {
    const world = forest_world();
    world.fertility[world.index(51, 50)] = 0;
    assert.equal(harvest_tree(world, 51, 50, 2), 0);
    assert.equal(world.tile(51, 50), T.GRASS);
    assert.equal(world.stumps.size, 1);
    assert.equal(harvest_tree(world, 51, 50, 2), 0);
    assert.equal(world.stumps.size, 1);
});

test('depleted trees remain stumps, become saplings, then regrow without RNG', () => {
    const world = forest_world();
    harvest_tree(world, 51, 50, 2);
    const rng = world.rng;
    advance_forestry(world, FORESTRY.stump_seconds);
    assert.equal(world.tile(51, 50), T.GRASS);
    assert.equal(world.stumps.get(world.index(51, 50)).age, FORESTRY.stump_seconds);
    assert.equal(world.rng, rng);
    advance_forestry(world, FORESTRY.growth_seconds);
    assert.equal(world.tile(51, 50), T.FOREST);
    assert.equal(world.stumps.size, 0);
    assert.ok(world.fertility[world.index(51, 50)] > 0.7);
    assert.equal(world.rng, rng);
});

test('stump state survives saves and old saves load without stump records', () => {
    const world = forest_world();
    harvest_tree(world, 51, 50, 2);
    advance_forestry(world, 35);
    const saved = world.serialize();
    assert.deepEqual(World.deserialize(saved).serialize(), saved);
    const legacy = { ...saved };
    delete legacy.stumps;
    assert.equal(World.deserialize(legacy).stumps.size, 0);
    for (const bad of [
        [[-1, T.FOREST, 0]], [[saved.tiles.length, T.FOREST, 0]],
        [[world.index(51, 50), T.GRASS, 0]], [[world.index(51, 50), T.FOREST, -1]],
        [[world.index(51, 50), T.FOREST, Infinity]],
        [[world.index(51, 50), T.FOREST, FORESTRY.stump_seconds + FORESTRY.growth_seconds]],
        [[world.index(51, 50), T.FOREST, 1], [world.index(51, 50), T.FOREST, 2]]
    ]) {
        const invalid = { ...saved, stumps: bad };
        assert.throws(() => World.deserialize(invalid));
    }
});

test('a stump changed by a later fire or weather update can be saved, then is pruned safely', () => {
    const world = forest_world();
    harvest_tree(world, 51, 50, 2);
    const i = world.index(51, 50);
    world.tiles[i] = T.ASH;
    const saved = world.serialize();
    const restored = World.deserialize(saved);
    assert.deepEqual(restored.serialize(), saved);
    advance_forestry(restored, 0.125);
    assert.equal(restored.stumps.size, 0);
    assert.equal(restored.tile(51, 50), T.ASH);
});

test('zero or negative elapsed time leaves forestry unchanged; elapsed growth is partition stable', () => {
    const one_step = forest_world(), partitions = forest_world();
    harvest_tree(one_step, 51, 50, 2); harvest_tree(partitions, 51, 50, 2);
    const before = structuredClone(one_step.serialize());
    advance_forestry(one_step, 0); advance_forestry(one_step, -1);
    assert.deepEqual(one_step.serialize(), before);
    advance_forestry(one_step, 120);
    for (let i = 0; i < 12; i++) advance_forestry(partitions, 10);
    assert.deepEqual(one_step.serialize().stumps, partitions.serialize().stumps);
    assert.equal(one_step.tile(51, 50), partitions.tile(51, 50));
    assert.ok(Math.abs(one_step.fertility[one_step.index(51, 50)]
        - partitions.fertility[partitions.index(51, 50)]) < 1e-6);
});

test('tree chop and fall produce distinct local sounds once, with no paused or offscreen replay', () => {
    const rendered = [];
    const node = () => ({ connect() {}, start() {}, frequency: {}, gain: { setTargetAtTime() {} } });
    const context = { state: 'running', currentTime: 0, destination: {}, createGain: node, createOscillator: node,
        async resume() {} };
    const audio = new GameAudio({ context: () => context, storage: { getItem: () => null, setItem() {} },
        speech: { getVoices: () => [], cancel() {} }, render: (_ctx, _dest, kind, pan) => {
            rendered.push({ kind, pan }); return 0.1;
        } });
    audio.settings.enabled = true;
    audio.context = context;
    audio.effects = {};
    assert.ok(SOUND_PROFILES.chop && SOUND_PROFILES.tree_fall);
    const paused = { type: 'tree_chop', x: 25, y: 30 };
    const effects = [
        { type: 'tree_chop', x: 25, y: 30 },
        { type: 'tree_fall', x: 75, y: 30 }
    ];
    const viewport = { origin: { x: 0, y: 0 }, scale: 1, width: 600, height: 240 };
    audio.observe_resources([paused], { ...viewport, active: false });
    audio.observe_resources([paused], { ...viewport, active: true });
    assert.deepEqual(rendered, []);
    const audible = [effects[0], effects[1]];
    audio.observe_resources(audible, { ...viewport, active: true });
    audio.observe_resources(audible, { ...viewport, active: true });
    assert.deepEqual(rendered.map(item => item.kind), ['chop', 'tree_fall']);
    assert.ok(rendered[0].pan < 0 && rendered[1].pan > 0);
    audio.observe_resources([{ type: 'tree_fall', x: 400, y: 30 }], { ...viewport, active: true });
    assert.equal(rendered.length, 2, 'offscreen activity is consumed without delayed replay');
});
