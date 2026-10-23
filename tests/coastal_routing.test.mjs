import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, RESEARCH_COSTS, technology_level } from '../src/simulation.js';
import { advance_machines } from '../src/machines.js';
import { ship_summary } from '../src/ship_inspector.js';
import { water_return_plan, water_segment } from '../src/water_navigation.js';
import { MAX_FOOD_STORES, diet_food_available } from '../src/diets.js';

function coast() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'concave-coast-return' });
    world.tiles.fill(T.GRASS);
    for (let y = 30; y <= 60; y++) for (let x = 30; x <= 60; x++) world.set_tile(x, y, T.OCEAN);
    // A peninsula forces a long southward detour before the westward return.
    for (let y = 30; y <= 52; y++) for (let x = 40; x <= 43; x++) world.set_tile(x, y, T.GRASS);
    world.set_tile(37, 36, T.GRASS);
    const home = world.found_village(28, 36);
    home.food = 0; home.food_stores = {}; home.wood = 0; home.research_level = 2;
    home.buildings = [{ type: 'dock', x: 37, y: 36, stock: 0, growth: 0, harvests: 0 }];
    world.add_person(home.x, home.y, home.id);
    const sailor = world.people[0];
    const boat = { id: world.next_id++, kingdom_id: home.id, kind: 'boat', x: 47.5, y: 37.5,
        dx: -1, dy: 0, health: 180, decision: 0, cooldown: 0, cargo: 6, delivered: 0,
        recipient_id: null, fishing_timer: 0, crew_id: sailor.id, crew_aboard: true };
    world.machines.push(boat);
    return { world, home, boat, docks: home.buildings,
        chosen: { kind: 'ship', collection: 'machines', id: boat.id } };
}

function advance(world, boat) {
    const before = { x: boat.x, y: boat.y };
    advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);
    assert.ok(world.tile(boat.x, boat.y) <= T.SHALLOW, 'the boat stays afloat');
    assert.ok(water_segment(world, before, boat), 'the movement segment never crosses land');
    assert.ok(Math.hypot(boat.x - before.x, boat.y - before.y) <= 0.200000001,
        'routing cannot teleport or exceed boat speed');
}

test('a loaded boat rounds a concave coast and unloads typed fish at its reachable harbor', () => {
    const { world, home, boat, docks, chosen } = coast();
    const plan = water_return_plan(world, boat, docks);
    assert.equal(plan.status, 'reachable');
    assert.deepEqual(plan.harbor, { x: 36.5, y: 35.5 });
    assert.equal(ship_summary(world, chosen).destination.x, plan.harbor.x);
    let south = boat.y;
    for (let step = 0; step < 700 && boat.delivered === 0; step++) {
        advance(world, boat); south = Math.max(south, boat.y);
    }
    assert.ok(south >= 53.5, 'the boat must go around the end of the peninsula');
    assert.equal(boat.delivered, 1); assert.equal(boat.cargo, 0);
    assert.equal(home.food, 6); assert.deepEqual(home.food_stores, { fish: 6 });
    assert.equal(diet_food_available(home, { diet_id: 'carnivore' }), 6);
    assert.equal(boat.fishing_timer, 0, 'time spent returning a loaded catch cannot accumulate a fresh catch');
    advance(world, boat);
    assert.equal(boat.delivered, 1); assert.equal(home.food, 6);
});

test('a full World step preserves a land-based dock and crew while the catch routes and unloads', () => {
    const { world, home, boat } = coast();
    home.food = 100; home.food_stores = { plant: 100 };
    for (const key of Object.keys(world.laws)) world.laws[key] = false;
    const sailor = world.people.find(person => person.id === boat.crew_id);
    sailor.x = boat.x; sailor.y = boat.y; sailor.trait_ids = []; sailor.diet_id = 'herbivore';
    for (let step = 0; step < 700 && boat.delivered === 0; step++) {
        world.step(0.125);
        assert.ok(home.buildings.some(building => building.type === 'dock'));
        assert.ok(world.tile(boat.x, boat.y) <= T.SHALLOW);
    }
    assert.equal(boat.delivered, 1); assert.equal(boat.cargo, 0);
    assert.equal(home.food_stores.fish, 6);
    assert.ok(sailor.health > 0); assert.equal(boat.crew_aboard, true);
    assert.deepEqual(World.deserialize(world.serialize()).serialize(), world.serialize());
});

test('terrain blockage invalidates cached routes, holds cargo, then opening water restores delivery', () => {
    const { world, home, boat, docks, chosen } = coast();
    assert.equal(water_return_plan(world, boat, docks).status, 'reachable');
    for (let step = 0; step < 20; step++) advance(world, boat);
    for (let y = 30; y <= 60; y++) world.set_tile(44, y, T.GRASS);
    assert.equal(water_return_plan(world, boat, docks).status, 'unreachable');
    const before = world.serialize(), position = { x: boat.x, y: boat.y };
    const summary = ship_summary(world, chosen);
    assert.equal(summary.destination, null); assert.equal(summary.activity, 'Carrying catch');
    assert.match(summary.reason, /connected.*water/);
    assert.deepEqual(world.serialize(), before, 'inspection cannot rewrite a blocked route or cargo');
    for (let step = 0; step < 12; step++) advance(world, boat);
    assert.deepEqual({ x: boat.x, y: boat.y }, position);
    assert.equal(boat.cargo, 6); assert.equal(home.food, 0);
    world.set_tile(44, 59, T.OCEAN);
    assert.equal(water_return_plan(world, boat, docks).status, 'reachable');
    for (let step = 0; step < 900 && boat.delivered === 0; step++) advance(world, boat);
    assert.equal(boat.delivered, 1); assert.deepEqual(home.food_stores, { fish: 6 });
});

test('a cold mid-route save resumes exactly without saved routing fields or RNG inspection changes', () => {
    const { world, boat, chosen } = coast();
    for (let step = 0; step < 37; step++) advance(world, boat);
    const saved = world.serialize(), restored = World.deserialize(saved);
    const restored_boat = restored.machines[0];
    assert.deepEqual(restored.serialize(), saved);
    world.random = () => { throw new Error('A catch return cannot roll randomness'); };
    restored.random = world.random;
    const before = restored.serialize();
    assert.deepEqual(ship_summary(restored, chosen), ship_summary(world, chosen));
    assert.deepEqual(restored.serialize(), before);
    for (let step = 0; step < 700 && boat.delivered === 0; step++) {
        advance(world, boat); advance(restored, restored_boat);
    }
    assert.equal(boat.delivered, 1);
    assert.deepEqual(restored.serialize(), world.serialize());
    assert.deepEqual(Object.keys(restored_boat), Object.keys(saved.machines[0]),
        'routing caches never become vessel/save fields');
});

test('harbor selection skips isolated dock water and responds to dock removal without terrain edits', () => {
    const { world, home, boat, docks, chosen } = coast();
    // First dock has a real water pocket, but it is disconnected from the boat.
    world.set_tile(15, 15, T.OCEAN);
    docks.unshift({ type: 'dock', x: 16, y: 16, stock: 0, growth: 0, harvests: 0 });
    assert.deepEqual(water_return_plan(world, boat, docks).harbor, { x: 36.5, y: 35.5 });
    home.buildings.pop();
    assert.equal(water_return_plan(world, boat, home.buildings).status, 'unreachable');
    assert.equal(ship_summary(world, chosen).destination, null);
    home.buildings = [];
    assert.equal(water_return_plan(world, boat, home.buildings).status, 'no_dock');
    advance(world, boat);
    assert.equal(boat.cargo, 6); assert.equal(home.food, 0);
});

test('full stores preserve the catch at the harbor until a single fish credit fits', () => {
    const { world, home, boat, docks, chosen } = coast();
    const harbor = water_return_plan(world, boat, docks).harbor;
    boat.x = harbor.x; boat.y = harbor.y;
    home.food = MAX_FOOD_STORES; home.food_stores = { plant: MAX_FOOD_STORES };
    advance(world, boat);
    assert.equal(boat.cargo, 6); assert.equal(boat.delivered, 0);
    assert.equal(ship_summary(world, chosen).activity, 'Waiting to unload');
    home.food -= 6;
    advance(world, boat);
    assert.equal(boat.cargo, 0); assert.equal(boat.delivered, 1);
    assert.equal(home.food, MAX_FOOD_STORES); assert.equal(home.food_stores.fish, 6);
    assert.equal(home.food_stores.plant, MAX_FOOD_STORES - 6);
});

test('water movement rejects skipped land and diagonal corner cuts at any step size', () => {
    const { world } = coast();
    assert.equal(water_segment(world, { x: 38.5, y: 35.5 }, { x: 47.5, y: 35.5 }), false);
    world.set_tile(50, 50, T.GRASS);
    assert.equal(water_segment(world, { x: 49.5, y: 50.5 }, { x: 50.5, y: 49.5 }), false);
    assert.equal(water_segment(world, { x: 47.5, y: 55.5 }, { x: 55.5, y: 55.5 }), true);
});
