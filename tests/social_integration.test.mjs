import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';

function town() {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(40, 40);
    kingdom.houses = [{ x: 40, y: 40 }, { x: 42, y: 40 }];
    for (let i = 0; i < 3; i++) world.add_person(40, 40, kingdom.id);
    return { world, kingdom };
}

test('children cannot mine, forge, retrain or enlist through aggregate town systems', () => {
    const { world, kingdom } = town();
    for (let i = 0; i < 3; i++) world.add_person(40, 40, kingdom.id);
    for (const person of world.people) {
        person.age = 10 * world.year_length;
        person.job = 'miner';
    }
    kingdom.ore.iron = 50;
    kingdom.research_level = 3; kingdom.tech_points = 50;
    kingdom.food = 100; kingdom.wood = 100;
    kingdom.mine_timer = kingdom.forge_timer = kingdom.training_timer = 8;
    kingdom.barracks = 1;
    world.ores[world.index(41, 40)] = 1;
    world.tick = 79;
    world.step(0.125);
    assert.equal(world.ores[world.index(41, 40)], 1);
    assert.equal(kingdom.ore.copper, 0);
    assert.equal(kingdom.weapons, 0);
    assert.equal(world.stats().soldiers, 0);
    assert.ok(world.people.every(p => p.job === 'miner'));
});

test('actual births retain adult partners, inherited identity and save continuity', () => {
    const { world, kingdom } = town();
    for (const person of world.people) person.trait = 'hardy';
    kingdom.birth_timer = 13;
    world.step(0.125);
    const child = world.people.find(person => person.parents.length === 2);
    assert.ok(child, 'nearby adult founders can start a family');
    assert.equal(child.age, 0);
    assert.equal(child.heritage_trait, 'hardy');
    const parents = child.parents.map(parent => world.people.find(p => p.id === parent.id));
    assert.ok(parents.every(parent => parent.age >= 18 * world.year_length));
    assert.equal(parents[0].partner_id, parents[1].id);
    assert.equal(child.family_id, parents[0].family_id);
    assert.equal(child.culture_id, parents[0].culture_id);
    const restored = World.deserialize(world.serialize());
    world.step(0.125); restored.step(0.125);
    assert.deepEqual(restored.serialize(), world.serialize());
});

test('a logger working beside a forest harvests the assigned source tile', () => {
    const { world, kingdom } = town();
    const logger = world.people.find(p => p.job === 'lumberjack');
    const source = world.index(41, 40);
    world.tiles[source] = T.FOREST;
    logger.x = 40.5; logger.y = 40.5; logger.gather = 3;
    logger.daily_life = { phase: 'work', energy: 80, timer: 0,
        site: { x: 41.5, y: 40.5, kind: 'forest' }, cargo: { food: 0, wood: 0 },
        delivered: 0, cycles: 0, partner_id: null };
    const before = world.fertility[source];
    world.step(0.125);
    assert.equal(world.tile(logger.x, logger.y), T.GRASS);
    assert.ok(logger.daily_life.cargo.wood > 0);
    assert.ok(world.fertility[source] < before);
    assert.equal(kingdom.wood, 15, 'carried timber is not deposited at a distance');
});

test('peaceful forging reserves construction timber and stops stockpiling spare weapons', () => {
    const { world, kingdom } = town();
    world.people[2].job = 'smith';
    kingdom.research_level = 1; kingdom.tech_points = 8;
    kingdom.ore.copper = 100;
    kingdom.barracks = 1;
    kingdom.wood = 15; kingdom.forge_timer = 10;
    for (const person of world.people) person.gather = 0;
    for (let i = 0; i < 5; i++) world.add_person(40, 40, kingdom.id);
    world.step(0.125);
    assert.equal(kingdom.wood, 15);
    assert.equal(kingdom.ore.copper, 100);
    kingdom.houses = [{ x: 40, y: 40 }];
    for (const person of world.people) person.weapon_level = 1;
    kingdom.weapons = 2; kingdom.wood = 20; kingdom.forge_timer = 10;
    world.step(0.125);
    assert.equal(kingdom.weapons, 2);
    assert.equal(kingdom.ore.copper, 100);
    kingdom.research_level = 3; kingdom.tech_points = 50;
    kingdom.ore.iron = 100; kingdom.forge_timer = 10;
    for (const person of world.people) person.weapon_level = 3;
    world.step(0.125);
    assert.equal(kingdom.weapons, 2, 'full spare stock does not create more weapons');
    assert.ok(world.people.some(person => person.armor_level === 3), 'armor can still be forged');
});
