import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, RESEARCH_COSTS, technology_level } from '../src/simulation.js';
import { advance_machines, MACHINES } from '../src/machines.js';
import { advance_defenses, advance_detention, defense_hit } from '../src/defenses.js';

function setup() {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const home = world.found_village(40, 50); world.add_person(40, 50, home.id);
    home.wood = 1000; home.food = 1000; home.ore.iron = 1000;
    home.research_level = 8;
    return { world, home };
}
function building(type, x, y) {
    return { type, x, y, growth: 0, harvests: 0, integrity: type === 'castle' ? 300 : 160 };
}
function machine(world, kingdom, kind, x = kingdom.x, y = kingdom.y) {
    const unit = { id: world.next_id++, kingdom_id: kingdom.id, kind, x, y, dx: 1, dy: 0,
        health: MACHINES[kind].health, decision: 0, cooldown: 0, cargo: 0, recipient_id: null, delivered: 0,
        crew_id: world.people.find(p => p.village_id === kingdom.id).id, crew_aboard: true };
    world.machines.push(unit); return unit;
}

test('a dock launches a boat that remains on water and fishes at a bounded rate', () => {
    const { world, home } = setup();
    for (let y = 30; y < 70; y++) for (let x = 42; x < 90; x++) world.set_tile(x, y, T.OCEAN);
    home.buildings = [building('dock', 41, 50)]; home.machine_timer = 20;
    const before = home.food;
    for (let step = 0; step < 200; step++) {
        advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);
        if (world.machines[0]) { world.machines[0].crew_id = world.people[0].id; world.machines[0].crew_aboard = true; }
    }
    assert.equal(world.machines.length, 1); assert.equal(world.machines[0].kind, 'boat');
    assert.ok(world.tile(world.machines[0].x, world.machines[0].y) <= T.SHALLOW);
    assert.equal(home.food + world.machines[0].cargo, before + 6);
    assert.deepEqual(World.deserialize(world.serialize()).machines, world.machines);
});

test('artillery fires a shell and damages nearby hostile troops and structures', () => {
    const { world, home } = setup();
    const enemy = world.found_village(58, 50); world.add_person(58, 50, enemy.id);
    enemy.buildings = [building('watchtower', 58, 50)];
    world.people.at(-1).role = 'soldier'; world.set_relation(home.id, enemy.id, 'war');
    const cannon = machine(world, home, 'artillery');
    advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);
    assert.ok(world.people.at(-1).health < 100);
    assert.equal(enemy.buildings[0].integrity, 130);
    assert.ok(world.effects.some(effect => effect.type === 'shell'));
    assert.equal(cannon.cooldown, 4);
});

test('watchtowers capture wounded soldiers into prisons, and peace releases them', () => {
    const { world, home } = setup(); home.research_level = 1;
    home.buildings = [building('watchtower', 42, 50), building('prison', 43, 53)];
    const enemy = world.found_village(55, 50); world.add_person(46, 50, enemy.id);
    const prisoner = world.people.at(-1); prisoner.role = 'soldier'; prisoner.health = 20;
    world.set_relation(home.id, enemy.id, 'war');
    advance_defenses(world, 0.125, technology_level);
    assert.equal(prisoner.prisoner_of, home.id); assert.equal(prisoner.x, 43);
    assert.equal(prisoner.task, 'Imprisoned');
    assert.equal(World.deserialize(world.serialize()).people.at(-1).prisoner_of, home.id);
    const gather = prisoner.gather; world.step(0.125); assert.equal(prisoner.gather, gather);
    world.set_relation(home.id, enemy.id, 'peace'); advance_detention(world, 0);
    assert.equal(prisoner.prisoner_of, null); assert.equal(prisoner.x, enemy.x);
});

test('a castle protects residents and slows a siege', () => {
    const { world, home } = setup();
    const enemy = world.found_village(60, 50); world.add_person(60, 50, enemy.id);
    for (let soldier = 0; soldier < 4; soldier++) {
        world.add_person(60, 50, home.id); world.people.at(-1).role = 'soldier';
    }
    world.set_relation(home.id, enemy.id, 'war'); world.tick = 8;
    const open_town = World.deserialize(world.serialize());
    enemy.buildings = [building('castle', 61, 50)];
    world.resolve_sieges(); open_town.resolve_sieges();
    assert.ok(enemy.siege < open_town.villages[1].siege);
    const resident = world.people.find(p => p.village_id === enemy.id);
    defense_hit(world, home.id, resident, 20);
    assert.equal(resident.health, 87);
});

test('aircraft cross an ocean and transfer real food to another peaceful kingdom', () => {
    const { world, home } = setup();
    const other = world.found_village(70, 50); world.add_person(70, 50, other.id); other.food = 10;
    for (let y = 0; y < 128; y++) for (let x = 50; x <= 60; x++) world.set_tile(x, y, T.OCEAN);
    const plane = machine(world, home, 'plane'); let crossed = false;
    for (let step = 0; step < 120; step++) {
        advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);
        crossed ||= plane.x > 50 && plane.x < 60;
    }
    assert.ok(crossed); assert.ok(plane.delivered > 0); assert.ok(other.food > 10);
    assert.equal(home.food + other.food + plane.cargo, 1010);
    assert.deepEqual(World.deserialize(world.serialize()).machines, world.machines);
});

test('survey balloons add research and malformed aircraft saves are rejected', () => {
    const { world, home } = setup();
    const balloon = machine(world, home, 'balloon');
    const before = home.tech_points;
    for (let step = 0; step < 80; step++) advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);
    assert.ok(home.tech_points > before); assert.ok(balloon.x !== home.x || balloon.y !== home.y);
    assert.deepEqual(World.deserialize(world.serialize()).machines, world.machines);
    const invalid = world.serialize(); invalid.machines[0].cargo = 100;
    assert.throws(() => World.deserialize(invalid), /not a valid/);
    const legacy = world.serialize(); delete legacy.machines;
    assert.deepEqual(World.deserialize(legacy).machines, []);
});
