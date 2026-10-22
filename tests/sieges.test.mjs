import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { siege_summary, SIEGE_REQUIRED } from '../src/sieges.js';

const building = (type, x, y, stock = 0) => ({ type, x, y, stock, growth: 0.25, harvests: 2 });
function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'town-sieges' });
    world.tiles.fill(T.GRASS);
    const attacker = world.found_village(30, 40), defender = world.found_village(70, 40);
    const rival = world.found_village(110, 40);
    for (const kingdom of [attacker, defender, rival]) {
        kingdom.food = 1000; kingdom.wood = 1000;
        world.add_person(kingdom.x, kingdom.y, kingdom.id);
    }
    world.set_relation(attacker.id, defender.id, 'war');
    const soldiers = (kingdom, count, site = defender) => Array.from({ length: count }, (_, index) => {
        world.add_person(site.x + index % 2 * 0.2, site.y, kingdom.id);
        const person = world.people.at(-1); person.role = 'soldier'; return person;
    });
    const pulse = (seconds = 1) => world.resolve_sieges(seconds);
    return { world, attacker, defender, rival, soldiers, pulse };
}

const roundtrip = world => assert.deepEqual(World.deserialize(world.serialize()).serialize(), world.serialize());

test('siege summary is pure and exposes separate soldiers, fortifications, pressure and outcome', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    soldiers(attacker, 4); soldiers(defender, 1);
    defender.buildings.push(building('castle', defender.x + 1, defender.y));
    const before = world.serialize(), summary = siege_summary(world, defender);
    assert.equal(summary.kind, 'capital'); assert.equal(summary.required, 48);
    assert.equal(summary.defenders, 1); assert.equal(summary.fortification, 3);
    assert.equal(summary.attackers, 4); assert.equal(summary.attacker_id, attacker.id);
    assert.equal(summary.attacker_name, attacker.name); assert.equal(summary.state, 'Contested');
    assert.match(summary.rule, /surrender/); assert.equal(summary.progress, 0);
    assert.deepEqual(world.serialize(), before, 'inspection cannot advance pressure, time or RNG');
    defender.buildings = []; pulse(0.125);
    const advancing = siege_summary(world, defender);
    assert.equal(advancing.progress, 0.25); assert.equal(advancing.percent, 0.25 / 48 * 100);
    assert.equal(advancing.state, 'Advancing');
});

test('huge forces and oversized pulses cannot instantly take a capital or town', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    soldiers(attacker, 80);
    pulse(100);
    assert.equal(defender.siege, 2); assert.equal(defender.alive, true);
    for (let index = 0; index < 22; index++) pulse();
    assert.equal(defender.siege, 46); assert.equal(defender.alive, true);
    pulse();
    assert.equal(defender.alive, false, 'even an overwhelming capital siege requires 24 simulation seconds');
    assert.match(world.events[0].text, /surrenders/); assert.match(world.events[0].text, /wars end/);
    assert.equal(SIEGE_REQUIRED.town, 24);
});

test('rival factions never inherit another kingdom pressure and withdrawal decays it first', () => {
    const { world, attacker, defender, rival, soldiers, pulse } = fixture();
    world.set_relation(rival.id, defender.id, 'war');
    const first = soldiers(attacker, 4); soldiers(rival, 3);
    pulse(); pulse();
    assert.equal(defender.siege, 4); assert.equal(defender.siege_attacker_id, attacker.id);
    first.forEach(person => { person.x = attacker.x; });
    let summary = siege_summary(world, defender);
    assert.equal(summary.state, 'Withdrawing'); assert.equal(summary.attacker_id, attacker.id);
    assert.equal(summary.attackers, 0, 'rival soldiers cannot count as the remembered attackers');
    for (let index = 0; index < 4; index++) pulse();
    assert.equal(defender.siege, 0); assert.equal(defender.siege_attacker_id, null);
    pulse(); summary = siege_summary(world, defender);
    assert.equal(summary.attacker_id, rival.id); assert.equal(summary.progress, 2);
});

test('peace immediately ends the pure projection, then clears saved pressure when time runs', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    soldiers(attacker, 4); pulse();
    world.set_relation(attacker.id, defender.id, 'peace');
    const before = world.serialize();
    assert.equal(defender.siege, 2);
    const summary = siege_summary(world, defender);
    assert.equal(summary.progress, 0); assert.equal(summary.percent, 0);
    assert.equal(summary.attacker_id, null); assert.equal(summary.state, 'Quiet');
    assert.deepEqual(world.serialize(), before);
    pulse(); assert.equal(defender.siege, 0); assert.equal(defender.siege_attacker_id, null);
});

test('defenders and castles slow or reverse pressure instead of permitting an instant breakthrough', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    soldiers(attacker, 4); pulse();
    defender.buildings.push(building('castle', defender.x + 1, defender.y));
    pulse(); assert.equal(defender.siege, 3, 'a castle reduces four attackers to one pressure per second');
    soldiers(defender, 1); pulse();
    assert.equal(defender.siege, 2); assert.equal(siege_summary(world, defender).state, 'Contested');
});

test('remote or locally unreachable troops cannot lay siege across a wall or distant detour', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    const force = soldiers(attacker, 3); force.forEach(person => { person.x = 66; });
    for (let y = 0; y < 128; y++) world.set_tile(68, y, T.MOUNTAIN);
    assert.equal(siege_summary(world, defender).attackers, 0); pulse(); assert.equal(defender.siege, 0);
    world.set_tile(68, 52, T.GRASS);
    assert.equal(siege_summary(world, defender).attackers, 0, 'a remote detour does not provide local assault access');
    world.set_tile(68, 40, T.GRASS);
    assert.equal(siege_summary(world, defender).attackers, 3);
    force.forEach(person => { person.x = 60; });
    pulse(); assert.equal(defender.siege, 0, 'soldiers outside the six-tile assault radius contribute nothing');
});

test('recovering, prisoner, voyage, crew, medical and wrong-home soldiers exert no pressure', () => {
    const { world, attacker, defender, rival, soldiers, pulse } = fixture();
    const force = soldiers(attacker, 8);
    force[0].recovering = true; force[1].prisoner_of = rival.id;
    force[2].voyage_id = 999; force[3].medical_role = 'doctor';
    force[4].home_id = defender.id;
    world.machines.push({ crew_id: force[5].id });
    force[6].health = 0; force[7].home_id = 99999;
    pulse(); assert.equal(siege_summary(world, defender).attackers, 0); assert.equal(defender.siege, 0);
    force[0].recovering = false; force[7].home_id = attacker.id;
    pulse(); assert.equal(defender.siege, 2); assert.equal(siege_summary(world, defender).attackers, 2);
});

test('saved attacker pressure roundtrips and legacy unattributed pressure cannot produce a free capture', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    soldiers(attacker, 3); pulse(0.125); pulse(0.125); roundtrip(world);
    const saved = world.serialize(), resumed = World.deserialize(saved);
    for (let index = 0; index < 20; index++) { pulse(0.125); resumed.resolve_sieges(0.125); }
    assert.deepEqual(resumed.serialize(), world.serialize());
    const legacy = structuredClone(saved);
    delete legacy.villages[1].siege_attacker_id; legacy.villages[1].siege = 999;
    const loaded = World.deserialize(legacy), before = loaded.serialize();
    assert.equal(siege_summary(loaded, loaded.villages[1]).progress, 0);
    assert.deepEqual(loaded.serialize(), before);
    loaded.resolve_sieges(0.125);
    assert.equal(loaded.villages[1].siege, 0.25); assert.equal(loaded.villages[1].alive, true);
    for (const value of [attacker.id + 999999, defender.id, '1', NaN, -1]) {
        const invalid = structuredClone(saved); invalid.villages[1].siege_attacker_id = value;
        assert.throws(() => World.deserialize(invalid), /valid Genesis/);
    }
    const excessive = structuredClone(saved); excessive.villages[1].siege = 49;
    assert.throws(() => World.deserialize(excessive), /valid Genesis/);
});

test('town capture keeps town and resident identities, preserves facilities and releases own captives', () => {
    const { world, attacker, defender, soldiers, pulse } = fixture();
    const town = world.found_colony(defender.id, 55, 40);
    world.add_person(town.x, town.y, defender.id);
    const resident = world.people.at(-1); resident.home_id = town.id;
    resident.prisoner_of = attacker.id; resident.sentence = 20;
    defender.buildings.push(building('clinic', town.x + 1, town.y, 12));
    const clinic = defender.buildings.at(-1);
    soldiers(attacker, 4, town);
    const identities = world.people.map(person => person.id), town_id = town.id;
    for (let index = 0; index < 11; index++) pulse();
    assert.equal(town.kingdom_id, defender.id); assert.equal(town.siege, 22);
    pulse();
    assert.equal(town.id, town_id); assert.equal(town.kingdom_id, attacker.id);
    assert.equal(resident.home_id, town_id); assert.equal(resident.village_id, attacker.id);
    assert.equal(resident.prisoner_of, null); assert.equal(resident.sentence, 0);
    assert.ok(attacker.buildings.includes(clinic)); assert.equal(clinic.stock, 12);
    assert.equal(defender.alive, true); assert.deepEqual(world.people.map(person => person.id), identities);
    assert.equal(town.siege, 0); assert.equal(town.siege_attacker_id, null); roundtrip(world);
});

test('capital surrender conserves people, homes, structures, stocks, voyages and equipment without inheriting wars', () => {
    const { world, attacker, defender, rival, soldiers } = fixture();
    world.set_relation(defender.id, rival.id, 'war'); world.set_relation(attacker.id, rival.id, 'alliance');
    const town = world.found_colony(defender.id, 85, 40);
    world.add_person(town.x, town.y, defender.id); const town_resident = world.people.at(-1); town_resident.home_id = town.id;
    const capital_resident = world.people.find(person => person.village_id === defender.id);
    const defeated_king = defender.king_id;
    const passengers = soldiers(defender, 3);
    const voyage = { id: world.next_id++, kingdom_id: defender.id, x: 90, y: 60,
        target_x: 130, target_y: 70, progress: 0.4, duration: 30, kind: 'ship', crew_ids: passengers.map(person => person.id) };
    world.voyages.push(voyage);
    passengers.forEach(person => { person.voyage_id = voyage.id; person.home_id = town.id; });
    const crew = soldiers(defender, 1)[0];
    const machine = { id: world.next_id++, kingdom_id: defender.id, kind: 'artillery', x: 70, y: 40,
        health: 120, dx: 0, dy: 0, decision: 0, cooldown: 0, cargo: 3, delivered: 2,
        recipient_id: defender.id, crew_id: crew.id, crew_aboard: true, boarding: { x: 70, y: 40 } };
    world.machines.push(machine);
    const vehicle = { id: world.next_id++, kingdom_id: defender.id, kind: 'cart', x: 70, y: 40,
        target_x: 85, target_y: 40, cargo: 4, returning: false, deliveries: 2 };
    world.vehicles.push(vehicle);
    const foreign_prisoner = world.people.find(person => person.village_id === rival.id);
    foreign_prisoner.prisoner_of = defender.id; foreign_prisoner.sentence = 20;
    capital_resident.prisoner_of = rival.id; capital_resident.sentence = 20;
    attacker.buildings = Array.from({ length: 64 }, () => building('farm', attacker.x + 1, 40, 1));
    defender.buildings = Array.from({ length: 64 }, (_, index) => building(index ? 'farm' : 'clinic', 71, 40, index ? 2 : 12));
    const facilities = defender.buildings.slice();
    attacker.ore.iron = 900000; defender.ore.iron = 900000;
    attacker.weapons = 800000; defender.weapons = 800000;
    attacker.armor_stock = 3; defender.armor_stock = 4;
    const trade = (from_id, to_id, good, amount) => ({ id: world.next_id++, from_id, to_id, good, amount,
        progress: 0.3, duration: 10, kind: 'caravan' });
    world.trades = [trade(defender.id, attacker.id, 'iron', 10), trade(attacker.id, defender.id, 'food', 7),
        trade(rival.id, defender.id, 'wood', 5), trade(defender.id, rival.id, 'food', 8)];
    soldiers(attacker, 2, attacker);
    world.army_orders = [{ id: `${attacker.id}:${attacker.id}`, kingdom_id: attacker.id,
        home_id: attacker.id, state: 'march', reason: 'campaign', target_id: defender.id, issued_tick: 0 }];
    const identities = world.people.map(person => person.id), food = attacker.food + defender.food;
    const wood = attacker.wood + defender.wood, home_id = town.id;
    assert.equal(world.conquer_site(defender, attacker.id), true);
    const captured = world.colonies.find(site => site.former_capital_id === defender.id);
    assert.ok(captured); assert.equal(captured.x, defender.x); assert.equal(captured.y, defender.y);
    assert.equal(capital_resident.home_id, captured.id); assert.equal(town_resident.home_id, home_id);
    assert.equal(town.kingdom_id, attacker.id); assert.ok(passengers.every(person => person.home_id === home_id));
    assert.deepEqual(world.people.map(person => person.id), identities);
    assert.ok(world.people.some(person => person.id === defeated_king && person.village_id === attacker.id));
    assert.equal(defender.alive, false); assert.equal(defender.king_id, null); assert.equal(defender.king_since_year, null);
    assert.equal(attacker.buildings.length, 128); assert.ok(facilities.every(facility => attacker.buildings.includes(facility)));
    assert.equal(defender.buildings.length, 0); assert.equal(facilities[0].stock, 12);
    assert.equal(attacker.food, food + 7); assert.equal(attacker.wood, wood);
    assert.equal(attacker.ore.iron, 1800010); assert.equal(attacker.weapons, 1600000); assert.equal(attacker.armor_stock, 7);
    assert.equal(defender.ore.iron, 0); assert.equal(defender.food, 0); assert.equal(defender.weapons, 0);
    assert.equal(machine.kingdom_id, attacker.id); assert.equal(machine.recipient_id, attacker.id);
    assert.equal(machine.crew_id, crew.id); assert.equal(crew.village_id, attacker.id);
    assert.equal(voyage.kingdom_id, attacker.id); assert.equal(voyage.progress, 0.4);
    assert.ok(passengers.every(person => person.village_id === attacker.id && person.voyage_id === voyage.id));
    assert.equal(vehicle.kingdom_id, attacker.id); assert.equal(vehicle.cargo, 4);
    assert.equal(world.trades.length, 2); assert.ok(world.trades.every(item => item.from_id !== defender.id && item.to_id !== defender.id));
    assert.equal(foreign_prisoner.prisoner_of, null); assert.equal(capital_resident.prisoner_of, null);
    assert.equal(world.relation_status(attacker.id, defender.id), 'peace');
    assert.equal(world.relation_status(defender.id, rival.id), 'peace');
    assert.equal(world.relation_status(attacker.id, rival.id), 'alliance');
    assert.ok(world.army_orders.every(order => !order.target_id));
    roundtrip(world);
    const after = world.serialize();
    assert.equal(world.conquer_site(defender, attacker.id), false); assert.deepEqual(world.serialize(), after);
});

test('capital surrender has a reserved slot when ordinary colony capacity is full', () => {
    const { world, attacker, defender } = fixture();
    for (let index = 0; index < 240; index++) assert.ok(world.found_colony(attacker.id, 20 + index % 100, 60));
    assert.equal(world.found_colony(attacker.id, 50, 65), null);
    assert.equal(world.conquer_site(defender, attacker.id), true);
    assert.equal(world.colonies.length, 241); assert.equal(world.colonies.at(-1).former_capital_id, defender.id);
    roundtrip(world);
    const corrupt = world.serialize(); corrupt.colonies.at(-1).former_capital_id = attacker.id;
    assert.throws(() => World.deserialize(corrupt), /valid Genesis/);
    const duplicate = world.serialize(); duplicate.colonies[0].former_capital_id = defender.id;
    assert.throws(() => World.deserialize(duplicate), /valid Genesis/);
});

test('capture is atomic on peace or invalid stock and budget validation includes internal cargo', () => {
    const { world, attacker, defender } = fixture();
    world.set_relation(attacker.id, defender.id, 'peace'); const peaceful = world.serialize();
    assert.equal(world.conquer_site(defender, attacker.id), false); assert.deepEqual(world.serialize(), peaceful);
    world.set_relation(attacker.id, defender.id, 'war');
    attacker.ore.iron = 120000000 - 10; defender.ore.iron = 0;
    world.trades.push({ id: world.next_id++, from_id: defender.id, to_id: attacker.id,
        good: 'iron', amount: 10, progress: 0.5, duration: 20, kind: 'caravan' });
    roundtrip(world);
    assert.equal(world.conquer_site(defender, attacker.id), true); assert.equal(attacker.ore.iron, 120000000);
    roundtrip(world);
    const invalid = fixture(); invalid.attacker.ore.iron = 120000000;
    invalid.world.trades.push({ id: invalid.world.next_id++, from_id: invalid.defender.id,
        to_id: invalid.attacker.id, good: 'iron', amount: 10, progress: 0.5, duration: 20, kind: 'caravan' });
    assert.throws(() => World.deserialize(invalid.world.serialize()), /valid Genesis/);
    let before = invalid.world.serialize();
    assert.equal(invalid.world.conquer_site(invalid.defender, invalid.attacker.id), false);
    assert.deepEqual(invalid.world.serialize(), before);
    invalid.attacker.food = NaN; before = invalid.world.serialize();
    assert.equal(invalid.world.conquer_site(invalid.defender, invalid.attacker.id), false);
    assert.deepEqual(invalid.world.serialize(), before);
});


test('painting at the kingdom limit cannot resurrect an annexed capital or duplicate its reserved town', () => {
    const { world, attacker, defender } = fixture();
    while (world.villages.length < 120) {
        const kingdom = world.found_village(180, 110);
        world.add_person(180, 110, kingdom.id);
    }
    assert.equal(world.conquer_site(defender, attacker.id), true);
    const homes = world.colonies.map(town => town.id), population = world.people.length;
    world.apply('elf', defender.x, defender.y, 1);
    assert.equal(world.people.length, population + 3);
    assert.equal(defender.alive, false);
    assert.ok(world.people.slice(-3).every(person => person.village_id !== defender.id));
    assert.deepEqual(world.colonies.map(town => town.id), homes);
    assert.equal(world.colonies.filter(town => town.former_capital_id === defender.id).length, 1);
    roundtrip(world);
});
