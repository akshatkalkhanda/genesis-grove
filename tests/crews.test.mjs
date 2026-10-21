import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, technology_level, RESEARCH_COSTS } from '../src/simulation.js';
import { MACHINES, advance_machines } from '../src/machines.js';

function airfield() {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50); kingdom.food = 1000; kingdom.wood = 0;
    kingdom.buildings = [{ type: 'aerodrome', x: 50, y: 50, growth: 0, harvests: 0, stock: 0 }];
    const balloon = { id: world.next_id++, kingdom_id: kingdom.id, kind: 'balloon',
        x: 50, y: 50, dx: 1, dy: 0, health: MACHINES.balloon.health,
        decision: 0, cooldown: 0, cargo: 0, recipient_id: null, delivered: 0 };
    world.machines.push(balloon);
    return { world, kingdom, balloon };
}

test('an empty balloon cannot fly or create research', () => {
    const { world, kingdom, balloon } = airfield();
    advance_machines(world, 1, technology_level, RESEARCH_COSTS);
    assert.equal(balloon.x, 50); assert.equal(balloon.y, 50); assert.equal(kingdom.tech_points, 0);
});

test('adult crew board, consume meals, travel with their vehicle and survive save round trips', () => {
    const { world, kingdom, balloon } = airfield();
    for (let i = 0; i < 8; i++) world.add_person(50, 50, kingdom.id);
    world.step(0.125);
    const pilot = world.people.find(p => p.id === balloon.crew_id);
    assert.ok(pilot && balloon.crew_aboard); assert.equal(pilot.task, 'Piloting aircraft');
    assert.equal(pilot.x, balloon.x); assert.equal(pilot.y, balloon.y);
    assert.ok(balloon.x !== 50 || balloon.y !== 50);
    assert.deepEqual(World.deserialize(world.serialize()).machines, world.machines);
    const bad = world.serialize(); bad.machines[0].crew_id = bad.next_id + 1;
    assert.throws(() => World.deserialize(bad), /valid Genesis/);
    pilot.health = 0; const x = balloon.x, y = balloon.y;
    advance_machines(world, 1, technology_level, RESEARCH_COSTS);
    assert.equal(balloon.x, x); assert.equal(balloon.y, y); assert.equal(balloon.crew_aboard, false);
});

test('children cannot staff a balloon and a single adult cannot crew two machines', () => {
    const { world, kingdom, balloon } = airfield();
    for (let i = 0; i < 8; i++) { world.add_person(50, 50, kingdom.id); world.people.at(-1).age = world.year_length * 10; }
    world.step(0.125); assert.equal(balloon.crew_aboard, false);
    world.people[0].age = world.year_length * 20; world.people[0].job = 'smith';
    const second = { ...balloon, id: world.next_id++ }; world.machines.push(second);
    world.step(0.125);
    assert.equal(world.machines.filter(m => m.crew_aboard).length, 1);
});

test('aboard sailors survive ocean cleanup and empty boats cannot fish', () => {
    const { world, kingdom, balloon: boat } = airfield();
    boat.kind = 'boat'; boat.health = MACHINES.boat.health;
    world.tiles[world.index(55, 50)] = T.OCEAN;
    boat.x = 55.5; boat.y = 50.5;
    const before = kingdom.food;
    for (let i = 0; i < 100; i++) advance_machines(world, 0.25, technology_level, RESEARCH_COSTS);
    assert.equal(kingdom.food, before);
    world.add_person(50, 50, kingdom.id);
    const sailor = world.people[0]; sailor.x = boat.x; sailor.y = boat.y;
    boat.crew_id = sailor.id; boat.crew_aboard = true;
    world.clean_up();
    assert.equal(world.people.length, 1); assert.equal(world.people[0].id, sailor.id);
    assert.deepEqual(World.deserialize(world.serialize()).machines, world.machines);
});
