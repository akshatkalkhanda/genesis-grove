import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, TECH_AGES, technology_level } from '../src/simulation.js';
import { advance_buildings } from '../src/settlements.js';

function developed_town() {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    kingdom.wood = 2000; kingdom.food = 2000;
    for (const ore of Object.keys(kingdom.ore)) kingdom.ore[ore] = 1000;
    for (let person = 0; person < 30; person++) world.add_person(50, 50, kingdom.id);
    kingdom.houses = [{ x: 48, y: 50 }, { x: 52, y: 50 }, { x: 50, y: 53 }];
    return { world, kingdom };
}

test('research advances beyond steel through all four later ages and equips a carbine', () => {
    const { world, kingdom } = developed_town();
    for (let cycle = 0; cycle < 28; cycle++) advance_buildings(world, kingdom, 12, 30, 8);
    assert.ok(kingdom.buildings.some(b => b.type === 'monument'));
    for (let level = 5; level <= 8; level++) {
        kingdom.research_level = level - 1;
        kingdom.tech_points = TECH_AGES[level].threshold - 0.00001;
        world.step(0.125);
        assert.equal(technology_level(kingdom), level);
    }
    kingdom.forge_timer = 10;
    world.step(0.125);
    assert.ok(world.people.some(p => p.weapon_level === 8));
    assert.equal(TECH_AGES[8].name, 'Modern Age');
    assert.deepEqual(World.deserialize(world.serialize()).villages[0].buildings, kingdom.buildings);
});

test('a kingdom needs its university before entering the gunpowder age', () => {
    const { world, kingdom } = developed_town();
    kingdom.research_level = 5; kingdom.tech_points = TECH_AGES[6].threshold;
    world.step(0.125); assert.equal(technology_level(kingdom), 5);
    kingdom.buildings.push({ type: 'university', x: 55, y: 55, growth: 0, harvests: 0 });
    world.step(0.125); assert.equal(technology_level(kingdom), 6);
});

test('firearms damage enemies at range and create a visible projectile', () => {
    const { world, kingdom } = developed_town();
    const enemy = world.found_village(60, 50);
    world.add_person(58, 50, enemy.id);
    const soldier = world.people[0]; soldier.role = 'soldier'; soldier.weapon_level = 8;
    const victim = world.people.at(-1);
    world.set_relation(kingdom.id, enemy.id, 'war');
    const before = victim.health;
    world.step(0.125);
    assert.ok(victim.health < before);
    assert.ok(world.effects.some(effect => effect.type === 'shot'));
    assert.equal(soldier.x, 50);
});

test('settlement prospecting reaches ore beyond the old twelve-tile limit', () => {
    const { world, kingdom } = developed_town();
    for (const ore of Object.keys(kingdom.ore)) kingdom.ore[ore] = 0;
    kingdom.age = 40 * world.year_length;
    kingdom.mine_timer = 8;
    world.ores[world.index(78, 50)] = 1;
    world.step(0.125);
    assert.equal(kingdom.ore.copper, 4);
    assert.equal(world.ores[world.index(78, 50)], 0);
});

test('armories recover equipment metal once when a creature dies', () => {
    const { world, kingdom } = developed_town();
    kingdom.buildings = [{ type: 'armory', x: 53, y: 50, growth: 0, harvests: 0 }];
    const person = world.people[0]; person.weapon_level = 4; person.armor_level = 4;
    person.health = 0;
    const before = kingdom.ore.iron;
    world.clean_up(); assert.equal(kingdom.ore.iron, before + 2);
    world.clean_up(); assert.equal(kingdom.ore.iron, before + 2);
});

test('armor and transport cannot consume the material reserve for the next discovery', () => {
    const { world, kingdom } = developed_town();
    kingdom.research_level = 7; kingdom.tech_points = 559; kingdom.forge_timer = 10;
    kingdom.ore.iron = 18; kingdom.ore.coal = 14; kingdom.ore.copper = 10;
    kingdom.buildings = [{ type: 'farm', x: 56, y: 50, growth: 0, harvests: 0 },
        { type: 'windmill', x: 53, y: 53, growth: 0, harvests: 0 }];
    kingdom.vehicle_timer = 24;
    world.vehicles.push({ id: world.next_id++, kingdom_id: kingdom.id, kind: 'cart',
        x: 50, y: 50, target_x: 56, target_y: 50, returning: false, cargo: 0, deliveries: 0 });
    world.step(0.125);
    assert.equal(kingdom.ore.iron, 16);
    assert.equal(world.people[0].armor_level, 0);
    assert.equal(world.vehicles[0].kind, 'cart');
});

test('all five cosmic ages consume stardust, unlock institutions, and preserve advanced saves', () => {
    const { world, kingdom } = developed_town();
    kingdom.ore.stardust = 1000;
    for (let cycle = 0; cycle < 30; cycle++) advance_buildings(world, kingdom, 12, 60, 13);
    for (let level = 9; level < TECH_AGES.length; level++) {
        kingdom.research_level = level - 1;
        kingdom.tech_points = TECH_AGES[level].threshold - 0.00001;
        const dust = kingdom.ore.stardust;
        world.step(0.125);
        assert.equal(technology_level(kingdom), level);
        assert.ok(kingdom.ore.stardust < dust);
    }
    assert.equal(TECH_AGES.length, 14);
    assert.equal(TECH_AGES.at(-1).name, 'Cosmic Dust Age');
    assert.ok(kingdom.buildings.some(b => b.type === 'condenser'));
    const restored = World.deserialize(world.serialize());
    assert.equal(restored.villages[0].research_level, 13);
    assert.equal(restored.villages[0].ore.stardust, kingdom.ore.stardust);
});

test('stardust can be placed and observatories collect it from the sky', () => {
    const { world, kingdom } = developed_town();
    kingdom.ore.stardust = 0;
    world.apply('stardust', 60, 50, 1);
    assert.equal(world.ores[world.index(60, 50)], 5);
    kingdom.buildings = [{ type: 'observatory', x: 55, y: 50, growth: 0, harvests: 0 }];
    advance_buildings(world, kingdom, world.year_length, 30, 8);
    assert.equal(kingdom.ore.stardust, 1);
    const old_save = world.serialize(); delete old_save.villages[0].ore.stardust;
    assert.equal(World.deserialize(old_save).villages[0].ore.stardust, 0);
});

test('mature towns retrain missing essential jobs and births fill workforce gaps', () => {
    const { world, kingdom } = developed_town();
    for (const person of world.people) person.job = 'builder';
    world.tick = 79; world.step(0.125);
    assert.deepEqual(new Set(world.people.map(p => p.job)),
        new Set(['farmer', 'lumberjack', 'miner', 'smith', 'builder']));
    world.people = world.people.filter(p => p.job !== 'miner');
    world.add_person(50, 50, kingdom.id);
    assert.equal(world.people.at(-1).job, 'miner');
});

test('iron-age miners uncover bounded underground seams and preserve their depletion in saves', () => {
    const { world, kingdom } = developed_town();
    kingdom.research_level = 3; kingdom.tech_points = 50;
    world.set_tile(52, 50, T.HILL);
    for (const ore of Object.keys(kingdom.ore)) kingdom.ore[ore] = 0;
    for (let cycle = 0; cycle < 3; cycle++) { kingdom.mine_timer = 8; world.step(0.125); }
    const index = world.index(52, 50);
    assert.equal(world.strata[index], 3);
    const material_count = Object.values(kingdom.ore).reduce((sum, amount) => sum + amount, 0);
    assert.equal(material_count, 12);
    kingdom.mine_timer = 8; world.step(0.125);
    assert.equal(Object.values(kingdom.ore).reduce((sum, amount) => sum + amount, 0), material_count);
    assert.equal(World.deserialize(world.serialize()).strata[index], 3);
    const corrupt = world.serialize(); corrupt.strata[index] = 4;
    assert.throws(() => World.deserialize(corrupt), /not a valid/);
});
