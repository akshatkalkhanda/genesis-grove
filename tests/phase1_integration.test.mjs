import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { decision_context, needs_intent, valid_needs } from '../src/needs.js';
import { add_food, diet_food_available } from '../src/diets.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'phase-one-regressions' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(40, 40);
    world.add_person(home.x, home.y, home.id);
    const person = world.people[0];
    person.trait_ids = []; person.infection = 0;
    home.food = 0; home.food_stores = {};
    for (const key of Object.keys(world.laws)) world.laws[key] = false;
    return { world, home, person };
}

function other_kingdom(world, x = 70) {
    const other = world.found_village(x, 40);
    other.food = 0; other.food_stores = {};
    return other;
}

function food_totals(world) {
    const totals = {};
    const ledgers = [...world.villages.map(kingdom => kingdom.food_stores),
        ...world.trades.map(trade => trade.food_cargo?.food_stores)];
    for (const stores of ledgers) for (const [source, amount] of Object.entries(stores || {})) {
        totals[source] = (totals[source] || 0) + amount;
    }
    return totals;
}

test('hungry carnivores choose reachable meat over a closer pile across an ocean wall', () => {
    const { world, home, person } = fixture();
    person.diet_id = 'carnivore'; person.needs.nutrition = 10;
    for (let y = 0; y < 128; y++) world.set_tile(42, y, T.OCEAN);
    world.food_piles = [
        { id: world.next_id++, x: 44, y: 40, source: 'meat', amount: 5, age: 0 },
        { id: world.next_id++, x: 30, y: 40, source: 'meat', amount: 5, age: 0 }
    ];
    const before = structuredClone(world.food_piles);
    const intent = needs_intent(world, person, 0.125, decision_context(world), home);
    assert.equal(intent.action, 'Seeking food');
    assert.equal(intent.x, 30); assert.equal(intent.y, 40);
    assert.deepEqual(world.food_piles, before, 'seeking cannot remotely consume either pile');
    assert.equal(person.needs.nutrition < 10, true);
});

test('an aboard aircraft crew member cannot hunt adjacent wildlife during a World step', () => {
    const { world, home, person } = fixture();
    person.age = world.year_length * 25;
    person.diet_id = 'carnivore'; person.needs.nutrition = 10;
    const plane = { id: world.next_id++, kingdom_id: home.id, kind: 'plane',
        x: person.x, y: person.y, dx: 1, dy: 0, health: 120,
        decision: 0, cooldown: 0, cargo: 0, recipient_id: null, delivered: 0,
        crew_id: person.id, crew_aboard: true };
    world.machines.push(plane);
    world.add_animal(40.5, 40, 'sheep');
    const prey = world.animals[0];
    prey.health = 5; prey.age = world.year_length * 10;
    prey.infection = 0; prey.needs.nutrition = 100;
    world.random = () => 0; // A forbidden hunting attempt would certainly hit.
    world.step(0.125);
    assert.equal(prey.health, 5);
    assert.ok(world.animals.some(animal => animal.id === prey.id));
    assert.equal(world.food_piles.length, 0);
    assert.equal(person.task, 'Piloting aircraft');
    assert.equal(person.x, plane.x); assert.equal(person.y, plane.y);
    assert.equal(person.needs.nutrition < 10, true, 'crew hunger still advances');
});

test('needs import requires both finite coordinates or no coordinates', () => {
    const { world } = fixture();
    for (const coordinates of [{ y: 40 }, { y: Infinity }, { x: 40 }, { x: 40, y: NaN }]) {
        const invalid = world.serialize();
        invalid.people[0].needs.intent = { action: 'Seeking food', reason: 'Following a food target.',
            holding: false, ...coordinates };
        assert.equal(valid_needs(invalid.people[0], invalid.time), false);
        assert.throws(() => World.deserialize(invalid), /valid Genesis/);
    }
    const valid = world.serialize();
    valid.people[0].needs.intent = { action: 'Seeking food', reason: 'Following a food target.',
        holding: false, x: 30, y: 40, route: true };
    assert.deepEqual(World.deserialize(valid).serialize(), valid);
});

test('ordinary food trades preserve source mix through pickup, mid-route import and delivery', () => {
    const { world, home } = fixture(), recipient = other_kingdom(world);
    add_food(home, 'plant', 3); add_food(home, 'meat', 5); add_food(home, 'fish', 20);
    add_food(recipient, 'fruit', 2);
    const before = food_totals(world);
    assert.equal(world.launch_trade(home, recipient, 'food', 12, world.landmasses()), true);
    assert.equal(home.food, 16);
    assert.deepEqual(world.trades[0].food_cargo,
        { amount: 12, food_stores: { plant: 3, meat: 5, fish: 4 } });
    assert.deepEqual(food_totals(world), before);
    world.advance_trades(1);
    const restored = World.deserialize(world.serialize());
    world.advance_trades(100); restored.advance_trades(100);
    assert.equal(world.trades.length, 0);
    assert.deepEqual(recipient.food_stores, { fruit: 2, plant: 3, meat: 5, fish: 4 });
    assert.equal(diet_food_available(recipient, { diet_id: 'carnivore' }), 9);
    assert.deepEqual(food_totals(world), before);
    assert.deepEqual(restored.serialize(), world.serialize());
});

test('capital surrender preserves typed stocks and internalized food shipments exactly once', () => {
    const { world, home: attacker } = fixture(), defender = other_kingdom(world);
    world.add_person(defender.x, defender.y, defender.id);
    const identities = world.people.map(person => person.id);
    add_food(attacker, 'grain', 3); add_food(attacker, 'fish', 8);
    add_food(defender, 'meat', 5); add_food(defender, 'fish', 7);
    assert.equal(world.launch_trade(defender, attacker, 'food', 6, world.landmasses()), true);
    const before = food_totals(world);
    world.set_relation(attacker.id, defender.id, 'war');
    assert.equal(world.conquer_site(defender, attacker.id), true);
    assert.equal(defender.alive, false);
    assert.equal(defender.food, 0); assert.deepEqual(defender.food_stores, {});
    assert.equal(world.trades.length, 0);
    assert.deepEqual(attacker.food_stores, { grain: 3, fish: 15, meat: 5 });
    assert.equal(attacker.food, 23);
    assert.equal(diet_food_available(attacker, { diet_id: 'carnivore' }), 20);
    assert.deepEqual(food_totals(world), before);
    assert.deepEqual(world.people.map(person => person.id), identities);
    const captured = world.serialize();
    assert.deepEqual(World.deserialize(captured).serialize(), captured);
    assert.equal(world.conquer_site(defender, attacker.id), false);
    assert.deepEqual(world.serialize(), captured, 'a repeated surrender cannot credit food again');
});
