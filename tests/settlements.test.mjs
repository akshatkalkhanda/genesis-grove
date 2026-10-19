import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_buildings } from '../src/settlements.js';

test('growing settlements build working farms, windmills, armories, and camps', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50); kingdom.houses.push({ x: 52, y: 50 });
    kingdom.wood = 1000;
    for (let cycle = 0; cycle < 4; cycle++) advance_buildings(world, kingdom, 12, 30, 2);
    assert.deepEqual(new Set(kingdom.buildings.map(b => b.type)), new Set(['farm', 'windmill', 'armory', 'camp']));
    const farm = kingdom.buildings.find(b => b.type === 'farm'); farm.growth = 0.99;
    const before = kingdom.food;
    advance_buildings(world, kingdom, 1, 30, 2);
    assert.equal(kingdom.food, before + 30);
    assert.ok(farm.harvests > 0);
    assert.deepEqual(World.deserialize(world.serialize()).villages[0].buildings, kingdom.buildings);
});
test('nearby training camps award soldier XP and armories accelerate forge work', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    world.add_person(50, 50);
    const kingdom = world.villages[0]; kingdom.food = 100;
    world.people[0].role = 'soldier';
    const baseline = World.deserialize(world.serialize());
    kingdom.buildings = ['camp', 'armory'].map(type => ({
        type, x: 52, y: 50, growth: 0, harvests: 0
    }));
    world.step(0.125); baseline.step(0.125);
    assert.ok(world.people[0].xp > baseline.people[0].xp);
    assert.ok(kingdom.forge_timer > baseline.villages[0].forge_timer);
    assert.equal(world.people[0].task, 'Training');
});
