import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_buildings } from '../src/settlements.js';
import { initialize_daily_life } from '../src/daily_life.js';

test('growing settlements build working farms, windmills, armories, and camps', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50); kingdom.houses.push({ x: 52, y: 50 });
    kingdom.wood = 1000; kingdom.food = 1000;
    for (let i = 0; i < 4; i++) { world.add_person(50, 50, kingdom.id); world.people.at(-1).job = 'farmer'; }
    for (let cycle = 0; cycle < 16; cycle++) advance_buildings(world, kingdom, 12, 30, 2);
    for (const type of ['farm', 'clinic', 'well', 'granary', 'school', 'church', 'temple', 'market', 'windmill', 'armory', 'camp']) {
        assert.ok(kingdom.buildings.some(b => b.type === type), type);
    }
    assert.equal(kingdom.buildings.filter(b => b.type === 'farm').length, 2);
    const farm = kingdom.buildings.find(b => b.type === 'farm'); farm.growth = 0.99;
    const farmer = world.people.find(person => person.job === 'farmer');
    farmer.age = world.year_length * 20; farmer.x = farm.x + 0.5; farmer.y = farm.y + 0.5;
    Object.assign(initialize_daily_life(farmer), { phase: 'work', timer: 0, energy: 80,
        site: { kind: 'farm', x: farm.x, y: farm.y } });
    const before = kingdom.food;
    advance_buildings(world, kingdom, 1, 30, 2);
    assert.equal(kingdom.food - before + farm.stock, 176,
        'the active local field receives one finite windmill-boosted harvest');
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
