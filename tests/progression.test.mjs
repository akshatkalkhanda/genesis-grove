import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, research_budget } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { advance_births, rebalance_settlement_jobs, settler_cohort, settlement_resources } from '../src/population.js';
import { BUILDINGS, advance_buildings } from '../src/settlements.js';
import { farm_target, food_reserve, food_secure } from '../src/civic.js';
import { farm_operational, find_building_plot, owns_plot } from '../src/settlement_land.js';

function world_with_town(seed = 'progression-tests') {
    const world = new World({ preset: 'empty', inhabited: false, seed });
    world.tiles.fill(T.GRASS); world.fertility.fill(0.8);
    for (const law of Object.keys(world.laws)) world.laws[law] = false;
    const kingdom = world.found_village(50, 50);
    kingdom.houses = [{ x: 50, y: 50 }, { x: 54, y: 50 }, { x: 58, y: 50 }];
    return { world, kingdom };
}

function adult(world, kingdom, home = kingdom, x = home.x, y = home.y, age = 28) {
    assert.equal(world.add_person(x, y, kingdom.id), true);
    const person = world.people.at(-1);
    person.age = age * world.year_length;
    person.health = creature_stats(person, world.year_length).max_health;
    person.needs.nutrition = 90; person.needs.hydration = 90; person.needs.energy = 90;
    person.home_id = home.id;
    return person;
}

function child(world, kingdom, home, parents, age = 8) {
    assert.equal(world.add_person(home.x, home.y, kingdom.id, kingdom.race, true), true);
    const person = world.people.at(-1);
    person.age = age * world.year_length; person.home_id = home.id;
    person.parents = parents.map(parent => ({ id: parent.id, name: parent.name }));
    return person;
}

test('surplus food clears the farm quota gate while low food still blocks recruitment', () => {
    const create = rich => {
        const { world, kingdom } = world_with_town(rich ? 'surplus-gate' : 'lowfood-gate');
        for (let i = 0; i < 12; i++) adult(world, kingdom);
        kingdom.wood = 100; kingdom.barracks = 1; kingdom.training_timer = 7.99;
        kingdom.food = rich ? food_reserve(12) * 2 + 20 : food_reserve(12) - 1;
        assert.equal(kingdom.buildings.filter(b => b.type === 'farm').length, 0);
        return { world, kingdom };
    };
    const rich = create(true);
    assert.equal(food_secure(rich.kingdom, 12, 0), true);
    assert.equal(rich.kingdom.buildings.filter(b => b.type === 'farm').length < farm_target(12), true);
    rich.world.step(0.125);
    assert.equal(rich.world.people.filter(person => person.role === 'soldier').length, 1,
        'demonstrated food surplus supports recruitment before the farm target is met');

    const low = create(false);
    assert.equal(food_secure(low.kingdom, 12, 0), false);
    low.world.step(0.125);
    assert.equal(low.world.people.filter(person => person.role === 'soldier').length, 0,
        'low food still blocks recruitment');
});

test('an inhabited colony receives university fallback when the capital has no legal plot', () => {
    const { world, kingdom } = world_with_town('university-fallback');
    const colony = world.found_colony(kingdom.id, 80, 50);
    colony.houses = [{ x: 78, y: 47 }, { x: 82, y: 47 }, { x: 78, y: 51 },
        { x: 82, y: 51 }, { x: 78, y: 55 }, { x: 82, y: 55 }];
    adult(world, kingdom, colony, colony.x, colony.y);
    // Leave the capital anchor walkable but make every nearby capital plot unusable.
    for (let y = 38; y <= 62; y++) for (let x = 38; x <= 62; x++) {
        if (x !== kingdom.x || y !== kingdom.y) world.set_tile(x, y, T.MOUNTAIN);
    }
    assert.equal(find_building_plot(world, kingdom, 'university', kingdom), null);
    const colony_plot = find_building_plot(world, kingdom, 'university', colony);
    assert.ok(colony_plot, 'the inhabited colony has a legal owned plot');

    kingdom.buildings = [
        { type: 'farm', x: 80, y: 50, growth: 0.4, harvests: 0, stock: 0 },
        { type: 'farm', x: 80, y: 55, growth: 0.4, harvests: 0, stock: 0 },
        ...Object.keys(BUILDINGS).slice(1, Object.keys(BUILDINGS).indexOf('university'))
            .filter(type => type !== 'farm').map(type => ({ type,
                x: type === 'well' ? colony.x : 50, y: type === 'well' ? colony.y : 50,
                growth: 0, harvests: 0, stock: 0 }))
    ];
    assert.equal(kingdom.buildings.filter(b => b.type === 'farm'
        && farm_operational(world, kingdom, b)).length, 2);
    kingdom.wood = 500; kingdom.food = food_reserve(20) * 2 + 20;
    kingdom.build_timer = 12;
    advance_buildings(world, kingdom, 0.125, 20, 5);
    const university = kingdom.buildings.find(building => building.type === 'university');
    assert.ok(university, 'building progression reaches a university');
    assert.equal(university.home_id, colony.id);
    assert.ok(owns_plot(world, kingdom.id, university.x, university.y));
    assert.ok(Math.hypot(university.x - colony.x, university.y - colony.y) <= 10);
});

test('each populated town can birth from its own viable household and pay the food cost', () => {
    const { world, kingdom } = world_with_town('local-births');
    const colony = world.found_colony(kingdom.id, 80, 50);
    kingdom.houses = [{ x: 50, y: 50 }]; colony.houses = [{ x: 80, y: 50 }];
    const parents_by_home = [];
    for (const home of [kingdom, colony]) {
        const first = adult(world, kingdom, home), second = adult(world, kingdom, home);
        first.partner_id = second.id; second.partner_id = first.id;
        parents_by_home.push({ home, parents: [first, second] });
        home.birth_timer = 13;
    }
    kingdom.food = 60;
    advance_births(world, kingdom, [kingdom, colony], 4);
    const newborns = world.people.filter(person => person.age === 0);
    assert.equal(newborns.length, 2);
    for (const { home, parents } of parents_by_home) {
        const local = newborns.find(person => person.home_id === home.id);
        assert.ok(local, `${home.name} births locally`);
        assert.deepEqual(local.parents.map(parent => parent.id), parents.map(parent => parent.id));
        assert.ok(home.houses.length * 5 >= world.people.filter(person => person.home_id === home.id).length,
            'birth stays within the town housing capacity');
    }
    assert.equal(kingdom.food, 50, 'each birth consumes five food');
    assert.equal(kingdom.birth_timer, 0); assert.equal(colony.birth_timer, 0);
});

test('settler cohorts keep both parents and dependent children together and reject partial or elder households', () => {
    const { world, kingdom } = world_with_town('whole-household');
    const first = adult(world, kingdom), second = adult(world, kingdom);
    first.partner_id = second.id; second.partner_id = first.id;
    const children = [child(world, kingdom, kingdom, [first, second], 7),
        child(world, kingdom, kingdom, [first, second], 12)];
    const selected = settler_cohort(world, kingdom.id, 8);
    assert.deepEqual(new Set(selected.map(person => person.id)),
        new Set([first.id, second.id, ...children.map(person => person.id)]));
    assert.deepEqual(settler_cohort(world, kingdom.id, 3), [],
        'a capacity shortage never splits parents from their children');

    first.age = 60 * world.year_length; second.age = 60 * world.year_length;
    const unrelated = adult(world, kingdom, kingdom, kingdom.x, kingdom.y, 25);
    assert.deepEqual(settler_cohort(world, kingdom.id, 8), [],
        'ineligible elder parents do not cause their children or an unrelated adult fallback to sail alone');
    assert.ok(unrelated.id > second.id);
});

test('resettlement uses one existing town, costs finite food but no ground-trip wood, and safely returns if destination is lost', () => {
    const { world, kingdom } = world_with_town('resettle-existing-town');
    const destination = world.found_colony(kingdom.id, 80, 50);
    const first = adult(world, kingdom), second = adult(world, kingdom);
    first.partner_id = second.id; second.partner_id = first.id;
    const children = [child(world, kingdom, kingdom, [first, second], 8),
        child(world, kingdom, kingdom, [first, second], 11)];
    kingdom.food = 50; kingdom.wood = 10;
    const initial_colonies = world.colonies.length;
    assert.equal(world.launch_colony(kingdom.id, destination.x, destination.y, null, destination), true);
    const voyage = world.voyages[0];
    assert.equal(voyage.origin_id, kingdom.id); assert.equal(voyage.destination_id, destination.id);
    assert.equal(voyage.kind, 'caravan'); assert.equal(voyage.well_kit, 0);
    assert.equal(kingdom.food, 40); assert.equal(kingdom.wood, 10,
        'a same-land relocation consumes no free wood');
    assert.deepEqual(new Set(voyage.crew_ids), new Set([first.id, second.id, ...children.map(person => person.id)]));
    assert.equal(world.launch_colony(kingdom.id, destination.x, destination.y, null, destination), false,
        'a destination cannot receive duplicate voyages');

    const resumed = World.deserialize(world.serialize());
    assert.deepEqual(resumed.serialize(), world.serialize());
    assert.equal(resumed.voyages[0].destination_id, destination.id);
    resumed.set_tile(destination.x, destination.y, T.OCEAN);
    resumed.advance_voyages(resumed.voyages[0].duration);
    assert.equal(resumed.voyages.length, 0);
    assert.equal(resumed.colonies.length, initial_colonies, 'lost destination does not create a duplicate town');
    for (const id of voyage.crew_ids) {
        const person = resumed.people.find(candidate => candidate.id === id);
        assert.equal(person.home_id, kingdom.id, 'the household returns to its recorded origin');
        assert.equal(person.voyage_id, null);
        assert.deepEqual([person.x, person.y], [kingdom.x, kingdom.y]);
    }
});

test('local town workforces cover farm, lumber and mining jobs and resource scores favor trees', () => {
    const { world, kingdom } = world_with_town('local-workforce');
    const colony = world.found_colony(kingdom.id, 80, 50);
    const groups = [];
    for (const home of [kingdom, colony]) {
        const local = Array.from({ length: 5 }, () => adult(world, kingdom, home));
        local.forEach(person => { person.job = 'builder'; });
        groups.push({ home, local });
    }
    rebalance_settlement_jobs(world, kingdom, groups.flatMap(group => group.local));
    for (const { local } of groups) {
        assert.deepEqual(new Set(local.map(person => person.job)),
            new Set(['farmer', 'lumberjack', 'miner', 'smith', 'builder']));
    }

    world.set_tile(55, 56, T.FOREST);
    world.ores[world.index(101, 101)] = 1;
    assert.equal(settlement_resources(world, { x: 50, y: 50 }), 3);
    assert.equal(settlement_resources(world, { x: 101, y: 101 }), 1);
});

test('abundant recipient food lets scheduled trade advance to needed timber', () => {
    const { world, kingdom } = world_with_town('timber-shipment');
    const recipient = world.found_village(65, 50);
    adult(world, kingdom); adult(world, recipient);
    kingdom.food = recipient.food = 200;
    kingdom.wood = 100; recipient.wood = 0;
    world.schedule_trades();
    assert.equal(world.trades.length, 1);
    assert.equal(world.trades[0].good, 'wood');
    assert.equal(world.trades[0].amount, 4);
});

function university_ready_world(wood, { well = true } = {}) {
    const { world, kingdom } = world_with_town(`university-budget-${wood}-${well}`);
    kingdom.houses = [{ x: 50, y: 50 }, { x: 54, y: 50 }, { x: 58, y: 50 }, { x: 62, y: 50 }];
    for (let i = 0; i < 20; i++) adult(world, kingdom);
    kingdom.buildings = [
        ...(well ? [{ type: 'well', x: 50, y: 50, growth: 1, harvests: 0, stock: 30 }] : []),
        { type: 'clinic', x: 54, y: 50, growth: 1, harvests: 0, stock: 0 }
    ];
    kingdom.food = food_reserve(20) * 2 + 20;
    kingdom.wood = wood;
    kingdom.research_level = 5; kingdom.tech_points = 250;
    kingdom.build_timer = 11.875;
    return { world, kingdom };
}

test('a funded university reserves its 30-wood cost plus 10 buffer instead of spending on farms or decor', () => {
    const { world, kingdom } = university_ready_world(39);
    assert.equal(BUILDINGS.university.wood, 30);
    assert.equal(research_budget(kingdom), 40);
    assert.equal(kingdom.food >= food_reserve(20) * 2, true);
    assert.equal(kingdom.buildings.filter(b => b.type === 'farm').length, 0,
        'the high food surplus permits construction even though the farm quota is unmet');
    const before_buildings = kingdom.buildings.map(building => building.type);
    world.step(0.125);
    assert.equal(kingdom.wood, 39, `wood below the university budget remains reserved: ${JSON.stringify({
        buildings: kingdom.buildings.map(building => building.type), road_timer: kingdom.road_timer,
        road_cursor: kingdom.road_cursor, forge_timer: kingdom.forge_timer
    })}`);
    assert.deepEqual(kingdom.buildings.map(building => building.type), before_buildings,
        'extra farms and optional buildings do not consume the university timber');
    assert.equal(kingdom.buildings.some(b => b.type === 'university'), false);
    assert.equal(kingdom.buildings.filter(b => b.type === 'farm').length < farm_target(20), true);
});

test('once university timber is funded, it builds for 30 wood and keeps the 10-wood buffer', () => {
    const { world, kingdom } = university_ready_world(40);
    const before = kingdom.wood;
    world.step(0.125);
    const university = kingdom.buildings.find(building => building.type === 'university');
    assert.ok(university);
    assert.ok(owns_plot(world, kingdom.id, university.x, university.y));
    assert.equal(kingdom.wood, before - BUILDINGS.university.wood);
    assert.equal(kingdom.wood, 10);
});

test('an urgent unserved well can spend timber while preserving a pending university budget', () => {
    const { world, kingdom } = university_ready_world(40, { well: false });
    assert.equal(research_budget(kingdom), 40);
    world.step(0.125);
    assert.ok(kingdom.buildings.some(building => building.type === 'well'));
    assert.equal(kingdom.buildings.some(building => building.type === 'university'), false,
        'well construction takes priority and defers the university until it can be funded again');
    assert.equal(kingdom.wood, 36, 'the well costs four wood and leaves the remaining budget intact');
});

test('timber donors retain a ready university budget while abundant recipients receive no food shipment', () => {
    const { world, kingdom: donor } = world_with_town('research-timber-trade');
    const recipient = world.found_village(65, 50);
    adult(world, donor); adult(world, recipient);
    donor.research_level = 5; donor.tech_points = 250;
    donor.food = 200; recipient.food = 100;
    donor.wood = 40; recipient.wood = 0;
    assert.equal(research_budget(donor), 40);
    world.schedule_trades();
    assert.equal(world.trades.length, 0,
        'the donor cannot send four wood below the ready university budget, and abundant recipient food is skipped');

    donor.wood = 60;
    world.schedule_trades();
    assert.equal(world.trades.length, 1);
    assert.equal(world.trades[0].good, 'wood');
    assert.equal(world.trades[0].amount, 4);
    assert.equal(world.trades.some(trade => trade.good === 'food'), false);
});
