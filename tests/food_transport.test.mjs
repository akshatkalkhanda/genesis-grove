import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, RESEARCH_COSTS, technology_level } from '../src/simulation.js';
import { advance_machines, MACHINES } from '../src/machines.js';
import { add_food, MAX_FOOD_STORES } from '../src/diets.js';

function setup(kind = 'plane') {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(40, 50), other = world.found_village(70, 50);
    for (const kingdom of [home, other]) {
        kingdom.food = 0; kingdom.food_stores = {}; kingdom.buildings = [];
    }
    world.add_person(home.x, home.y, home.id);
    const machine = { id: world.next_id++, kingdom_id: home.id, kind,
        x: home.x, y: home.y, dx: 1, dy: 0, health: MACHINES[kind].health,
        decision: 0, cooldown: 0, cargo: 0, recipient_id: null, delivered: 0,
        crew_id: world.people[0].id, crew_aboard: true };
    world.machines.push(machine);
    return { world, home, other, machine };
}

const advance = world => advance_machines(world, 0.125, technology_level, RESEARCH_COSTS);

function source_totals(world) {
    const totals = {};
    const stores = [...world.villages.map(kingdom => kingdom.food_stores),
        ...world.machines.map(machine => machine.food_cargo?.food_stores)];
    for (const ledger of stores) for (const [source, amount] of Object.entries(ledger || {})) {
        totals[source] = (totals[source] || 0) + amount;
    }
    return totals;
}

test('planes and airships conserve typed sources through real pickup and delivery', () => {
    for (const kind of ['plane', 'airship']) {
        const { world, home, other, machine } = setup(kind);
        add_food(home, 'meat', 8); add_food(home, 'fish', 40);
        const before = source_totals(world);
        advance(world);
        assert.equal(home.food, 36);
        assert.equal(machine.cargo, 12);
        assert.deepEqual(machine.food_cargo, { amount: 12, food_stores: { meat: 8, fish: 4 } });
        assert.deepEqual(source_totals(world), before);
        for (let step = 0; !machine.delivered && step < 100; step++) advance(world);
        assert.equal(machine.delivered, 1);
        assert.equal(machine.cargo, 0);
        assert.equal(machine.food_cargo, undefined);
        assert.deepEqual(other.food_stores, { meat: 8, fish: 4 });
        assert.deepEqual(source_totals(world), before);
    }
});

test('cancelled recipients refund the original food mix exactly once', () => {
    for (const cancellation of ['war', 'dead']) {
        const { world, home, other, machine } = setup();
        add_food(home, 'meat', 48);
        advance(world);
        if (cancellation === 'war') world.set_relation(home.id, other.id, 'war');
        else other.alive = false;
        advance(world);
        assert.deepEqual(home.food_stores, { meat: 48 });
        assert.equal(home.food, 48);
        assert.equal(machine.cargo, 0);
        assert.equal(machine.food_cargo, undefined);
        assert.equal(machine.recipient_id, null);
        advance(world);
        assert.equal(home.food, 48);
        assert.equal(machine.delivered, 0);
    }
});

test('full destinations retain typed cargo until delivery or refund fits', () => {
    const { world, home, other, machine } = setup();
    add_food(home, 'meat', 48);
    advance(world);
    add_food(other, 'plant', MAX_FOOD_STORES);
    machine.x = other.x; machine.y = other.y;
    advance(world);
    assert.equal(machine.cargo, 12);
    assert.equal(machine.delivered, 0);
    assert.deepEqual(machine.food_cargo.food_stores, { meat: 12 });
    world.set_relation(home.id, other.id, 'war');
    add_food(home, 'plant', MAX_FOOD_STORES);
    advance(world);
    assert.equal(machine.cargo, 12);
    assert.equal(machine.recipient_id, null);
    home.food -= 12;
    advance(world);
    assert.equal(machine.cargo, 0);
    assert.equal(home.food_stores.meat, 48);
    assert.equal(home.food, MAX_FOOD_STORES);
});

test('mid-flight typed food survives import and resumes identically', () => {
    const { world, home } = setup();
    add_food(home, 'meat', 6); add_food(home, 'fish', 42);
    for (let step = 0; step < 10; step++) advance(world);
    const restored = World.deserialize(world.serialize());
    assert.deepEqual(restored.machines, world.machines);
    for (let step = 0; step < 100; step++) { advance(world); advance(restored); }
    assert.deepEqual(restored.serialize(), world.serialize());
    const invalid = world.serialize();
    invalid.machines[0].food_cargo = { amount: 12, food_stores: { meat: 11 } };
    assert.throws(() => World.deserialize(invalid), /not a valid/);
});

test('legacy scalar aircraft cargo imports and delivers as generic plant food', () => {
    const { world, home, other, machine } = setup();
    machine.cargo = 12; machine.recipient_id = other.id;
    machine.x = other.x; machine.y = other.y;
    const restored = World.deserialize(world.serialize());
    const restored_other = restored.villages.find(kingdom => kingdom.id === other.id);
    advance(restored);
    assert.deepEqual(restored_other.food_stores, { plant: 12 });
    assert.equal(restored.machines[0].cargo, 0);
    assert.equal(restored.machines[0].food_cargo, undefined);
    assert.equal(home.food, 0);
});
