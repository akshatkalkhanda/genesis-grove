import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { ship_summary, ship_position, ship_near } from '../src/ship_inspector.js';

const selection = (collection, id) => ({ kind: 'ship', collection, id });

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'ship-inspection' });
    world.tiles.fill(T.GRASS);
    for (let y = 0; y < 128; y++) world.set_tile(70, y, T.OCEAN);
    const home = world.found_village(40, 40), other = world.found_village(110, 70);
    home.food = 100; home.wood = 100;
    for (let index = 0; index < 3; index++) world.add_person(40, 40, home.id);
    assert.equal(world.launch_colony(home.id, 110, 90), true);
    const voyage = world.voyages[0]; voyage.progress = 0.25;
    assert.equal(world.launch_trade(home, other, 'food', 6, world.landmasses()), true);
    const trade = world.trades[0]; trade.progress = 0.5;
    world.add_person(40, 40, home.id);
    const sailor = world.people.at(-1);
    const boat = { id: world.next_id++, kingdom_id: home.id, kind: 'boat',
        x: 70.5, y: 50.5, dx: 0, dy: 1, health: 150, decision: 0, cooldown: 0,
        cargo: 0, recipient_id: null, delivered: 0, fishing_timer: 8,
        crew_id: sailor.id, crew_aboard: true };
    world.machines.push(boat);
    return { world, home, other, voyage, trade, boat, sailor };
}

test('settler and trade ship positions exactly match the rendered interpolation', () => {
    const { world, home, other, voyage, trade, boat } = fixture();
    assert.deepEqual(ship_position(world, selection('voyages', voyage.id)), {
        x: voyage.x + (voyage.target_x - voyage.x) * voyage.progress,
        y: voyage.y + (voyage.target_y - voyage.y) * voyage.progress
    });
    const trade_point = { x: home.x + (other.x - home.x) * trade.progress,
        y: home.y + (other.y - home.y) * trade.progress };
    assert.deepEqual(ship_position(world, selection('trades', trade.id)), trade_point);
    assert.deepEqual(ship_near(world, trade_point.x, trade_point.y, 0.01), selection('trades', trade.id));
    assert.deepEqual(ship_position(world, selection('machines', boat.id)), { x: boat.x, y: boat.y });
    assert.equal(ship_near(world, home.x, home.y, 0.01), null,
        'a mid-voyage icon is not selected at its departure point');
});

test('settler crew reflects actual citizen identities and unmodeled inventory stays unavailable', () => {
    const { world, home, voyage } = fixture();
    const summary = ship_summary(world, selection('voyages', voyage.id));
    assert.equal(summary.owner.id, home.id);
    assert.equal(summary.title, 'Settler ship');
    assert.equal(summary.crew.label, 'Settlers');
    assert.equal(summary.crew.aboard, true);
    assert.deepEqual(summary.crew.members.map(person => person.id), voyage.crew_ids);
    assert.equal(summary.passengers, null, 'the model does not separate sailors from settler passengers');
    assert.equal(summary.health, null);
    assert.equal(summary.cargo, null, 'launch costs are not a carried ration inventory');
    assert.equal(summary.route.progress, voyage.progress);
    assert.equal(summary.destination.x, voyage.target_x);
    assert.equal(summary.destination.y, voyage.target_y);
    summary.crew.members[0].health = 0;
    assert.deepEqual(ship_summary(world, selection('voyages', voyage.id)).crew.members
        .map(person => person.id), voyage.crew_ids.slice(1), 'deceased settlers are not counted aboard');
});

test('trade ships show real cargo, ownership and pending cancellation without invented crew or hulls', () => {
    const { world, home, other, trade } = fixture();
    trade.food_cargo = { amount: 6, food_stores: { meat: 2, fish: 4 } };
    const chosen = selection('trades', trade.id);
    const summary = ship_summary(world, chosen);
    assert.equal(summary.owner, home);
    assert.equal(summary.origin.kingdom_id, home.id);
    assert.equal(summary.destination.kingdom_id, other.id);
    assert.deepEqual(summary.cargo, { good: 'food', label: 'Food', amount: 6,
        sources: { meat: 2, fish: 4 } });
    assert.equal(summary.health, null); assert.equal(summary.crew, null);
    assert.equal(summary.passengers, null);
    assert.equal(summary.activity, 'Delivering cargo');
    world.set_relation(home.id, other.id, 'war');
    const before = world.serialize();
    assert.equal(ship_summary(world, chosen).activity, 'Shipment awaiting review');
    assert.deepEqual(world.serialize(), before);
    delete trade.food_cargo;
    assert.equal(ship_summary(world, chosen).cargo.sources, null, 'legacy source mix is not invented');
});

test('coastal boats expose modeled health, crew, catch and the actual harbor destination', () => {
    const { world, home, boat, sailor } = fixture(), chosen = selection('machines', boat.id);
    let summary = ship_summary(world, chosen);
    assert.deepEqual(summary.health, { current: 150, max: 180 });
    assert.equal(summary.crew.members[0], sailor);
    assert.equal(summary.activity, 'Fishing');
    assert.equal(summary.destination, null);
    assert.equal(summary.route, null); assert.equal(summary.progress, null);
    boat.cargo = 6;
    summary = ship_summary(world, chosen);
    assert.equal(summary.activity, 'Carrying catch');
    assert.equal(summary.destination, null);
    assert.deepEqual(summary.cargo, { good: 'food', label: 'Food', amount: 6, sources: null });
    home.buildings.push({ type: 'dock', x: 69, y: 45, growth: 0, harvests: 0, stock: 0 });
    summary = ship_summary(world, chosen);
    assert.equal(summary.activity, 'Returning catch');
    assert.deepEqual(summary.destination, { x: 70.5, y: 44.5,
        label: `${home.name} dock`, kingdom_id: home.id });
    boat.crew_aboard = false; boat.boarding = { x: 69.5, y: 50.5 };
    summary = ship_summary(world, chosen);
    assert.equal(summary.activity, 'Boarding crew');
    assert.equal(summary.destination, null, 'a person boarding does not give the boat a travel destination');
    assert.equal(summary.boarding_point.label, 'Crew boarding point');
    assert.equal(summary.boarding_point.x, boat.boarding.x);
    boat.crew_id = null;
    assert.equal(ship_summary(world, chosen).activity, 'Awaiting crew');
});

test('existing coastal cannon state is distinguished from fishing without simulating an attack', () => {
    const { world, home, other, boat } = fixture(), chosen = selection('machines', boat.id);
    home.research_level = 6;
    world.add_person(boat.x + 2, boat.y, other.id);
    world.set_relation(home.id, other.id, 'war');
    const health = world.people.at(-1).health;
    assert.equal(ship_summary(world, chosen).activity, 'Engaging nearby enemies');
    boat.cooldown = 2;
    assert.equal(ship_summary(world, chosen).activity, 'Reloading coastal cannon');
    assert.equal(world.people.at(-1).health, health);
    boat.cooldown = 0; home.food = 2;
    assert.equal(ship_summary(world, chosen).activity, 'Holding fire');
    home.research_level = 0;
    assert.equal(ship_summary(world, chosen).activity, 'Fishing', 'unarmed boats do not claim cannon activity');
});

test('inspection and hit queries are paused read-only projections and survive save/load identity', () => {
    const { world, voyage, trade, boat } = fixture();
    const before = world.serialize();
    world.random = () => { throw new Error('Inspection must not roll randomness'); };
    const selections = [selection('voyages', voyage.id), selection('trades', trade.id), selection('machines', boat.id)];
    const summaries = selections.map(chosen => ship_summary(world, chosen));
    for (const chosen of selections) {
        const point = ship_position(world, chosen);
        assert.deepEqual(ship_near(world, point.x, point.y, 0.01), chosen);
    }
    assert.deepEqual(world.serialize(), before);
    const restored = World.deserialize(before), restored_before = restored.serialize();
    assert.deepEqual(selections.map(chosen => ship_summary(restored, chosen)), summaries);
    assert.deepEqual(restored.serialize(), restored_before);
    assert.deepEqual(Object.keys(restored_before), Object.keys(before), 'selection is never saved');
});

test('collection identity prevents cross-type collisions and exact-distance ties follow draw order', () => {
    const { world, home, other, voyage, trade, boat } = fixture();
    voyage.id = 999; trade.id = 999; boat.id = 999;
    voyage.x = home.x; voyage.y = home.y;
    voyage.target_x = other.x; voyage.target_y = other.y; voyage.progress = 0.5;
    boat.x = (home.x + other.x) / 2; boat.y = (home.y + other.y) / 2;
    assert.deepEqual(ship_near(world, boat.x, boat.y, 1), selection('machines', 999));
    world.machines = [];
    assert.deepEqual(ship_near(world, boat.x, boat.y, 1), selection('trades', 999));
    world.trades = [];
    assert.deepEqual(ship_near(world, boat.x, boat.y, 1), selection('voyages', 999));
    assert.equal(ship_summary(world, selection('trades', 999)), null,
        'a stale trade selection cannot jump to a voyage with the same numeric ID');
});

test('caravans, aircraft and land vehicles are excluded; missing vessel endpoints fail safely', () => {
    const { world, voyage, trade, boat } = fixture();
    voyage.kind = 'caravan'; trade.kind = 'caravan'; boat.kind = 'plane';
    world.vehicles = [{ id: 999, kind: 'starbarge', x: 5, y: 5 }];
    for (const chosen of [selection('voyages', voyage.id), selection('trades', trade.id),
        selection('machines', boat.id), selection('vehicles', 999), selection('machines', -1),
        { kind: 'person', collection: 'machines', id: boat.id }, null]) {
        assert.equal(ship_summary(world, chosen), null);
        assert.equal(ship_position(world, chosen), null);
    }
    assert.equal(ship_near(world, 5, 5, 1000), null);
    assert.equal(ship_near(world, 5, 5, -1), null);
    assert.equal(ship_near(world, NaN, 5, 4), null);
    trade.kind = 'ship'; trade.to_id = -1;
    assert.equal(ship_summary(world, selection('trades', trade.id)), null);
    assert.equal(ship_near(world, 5, 5, 1000), null);
});
