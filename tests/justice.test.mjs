import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { attempt_theft } from '../src/daily_life.js';
import { decision_context } from '../src/needs.js';
import { empty_justice, JUSTICE, justice_busy, justice_summary, record_theft, recover_goods } from '../src/justice.js';
import { kingdom_wellbeing } from '../src/kingdom_wellbeing.js';

function setup(population = 12) {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'justice-tests' });
    world.tiles.fill(T.GRASS);
    for (const key of Object.keys(world.laws)) world.laws[key] = false;
    const kingdom = world.found_village(50, 50);
    kingdom.houses = [{ x: 50, y: 50 }, { x: 54, y: 50 }];
    kingdom.buildings.push({ type: 'police_station', x: 50, y: 50, growth: 1, harvests: 0 });
    for (let i = 0; i < population; i++) {
        assert.equal(world.add_person(50, 50, kingdom.id), true);
        const person = world.people.at(-1);
        person.age = world.year_length * 24;
        person.health = creature_stats(person, world.year_length).max_health;
        person.needs.nutrition = 90; person.needs.hydration = 90; person.needs.energy = 90;
        person.home_id = kingdom.id; person.decision = 9.9;
        person.daily_life = { phase: 'work', energy: 90, timer: 0,
            site: { kind: 'home', x: 50, y: 50 }, cargo: { food: 0, wood: 0 },
            delivered: 0, cycles: 0, partner_id: null };
    }
    kingdom.king_id = world.people[0].id;
    world.random = () => 0.99;
    return { world, kingdom, people: world.people };
}

function make_witness_context(world) {
    world._justice_context = decision_context(world).people;
}

function reported_case(world, suspect, victim, { status = 'open', officer = null, x = 56, y = 50 } = {}) {
    suspect.x = x; suspect.y = y;
    victim.x = 50; victim.y = 50;
    const witness = world.people.find(person => person.id !== suspect.id && person.id !== victim.id);
    witness.x = x - 1; witness.y = y;
    make_witness_context(world);
    const c = record_theft(world, suspect, victim, 'food', 1);
    assert.ok(c.witnesses.length, 'fixture creates a witnessed case');
    c.status = status;
    if (['pursuit', 'escort', 'jailed'].includes(status)) {
        c.officer_id = officer.id; c.station_x = 50; c.station_y = 50;
        if (status === 'jailed') c.remaining = 4;
        world.justice.patrols = [{ officer_id: officer.id, kingdom_id: c.kingdom_id,
            x: 50, y: 50, target_x: 50, target_y: 50, timer: 4 }];
    }
    return c;
}

function set_random(world, value, fn) {
    const original = world.random;
    world.random = () => value;
    try { return fn(); } finally { world.random = original; }
}

test('a real witnessed theft transfers finite carried food and creates an open case', () => {
    const { world, people } = setup();
    const [king, thief, victim, witness] = people;
    thief.trait_ids = ['thief'];
    thief.daily_life.cargo.food = 0; victim.daily_life.cargo.food = 2;
    witness.x = thief.x + 1;
    make_witness_context(world);
    const result = attempt_theft(world, thief, victim);
    assert.deepEqual(result, { good: 'food', amount: 1, victim_id: victim.id });
    assert.equal(victim.daily_life.cargo.food, 1);
    assert.equal(thief.daily_life.cargo.food, 1);
    assert.equal(world.justice.cases.length, 1);
    const [c] = world.justice.cases;
    assert.equal(c.status, 'open'); assert.equal(c.good, 'food'); assert.equal(c.amount, 1);
    assert.ok(c.witnesses.includes(witness.id));
    assert.equal(king.id, world.villages[0].king_id);
    assert.equal(victim.daily_life.cargo.food + thief.daily_life.cargo.food, 2);
});

test('theft with no reachable witness or noticing victim remains unreported', () => {
    const { world, people } = setup();
    const [king, thief, victim] = people;
    thief.trait_ids = ['thief']; thief.daily_life.cargo.food = 0;
    victim.daily_life.cargo.food = 1;
    world._justice_context = new Map();
    const result = set_random(world, 0.99, () => attempt_theft(world, thief, victim));
    assert.equal(result?.amount, 1);
    assert.equal(world.justice.cases[0].status, 'unreported');
    assert.deepEqual(world.justice.cases[0].witnesses, []);
    assert.equal(world.villages[0].king_id, king.id);
});

test('finite restitution is idempotent, preserves typed food totals and cannot replace spent cargo', () => {
    const { world, people, kingdom } = setup();
    const [suspect, victim] = people;
    suspect.daily_life.cargo.food = 0.7;
    victim.daily_life.cargo.food = 11.8;
    const c = { suspect_id: suspect.id, victim_id: victim.id, kingdom_id: kingdom.id,
        good: 'food', amount: 0.7, recovered: 0 };
    const total = () => kingdom.food + suspect.daily_life.cargo.food + victim.daily_life.cargo.food;
    const before = total();
    assert.equal(recover_goods(world, c), 0.7);
    assert.equal(c.recovered, 0.7);
    assert.ok(Math.abs(total() - before) < 1e-9);
    assert.ok(Math.abs(victim.daily_life.cargo.food - 12) < 1e-9);
    assert.ok(Math.abs(kingdom.food - (35 + 0.5)) < 1e-9);
    assert.equal(recover_goods(world, c), 0, 'repeated recovery cannot duplicate goods');
    assert.ok(Math.abs(total() - before) < 1e-9);

    const spent = { ...c, amount: 1, recovered: 0 };
    suspect.daily_life.cargo.food = 0;
    const after_spend = total();
    assert.equal(recover_goods(world, spent), 0);
    assert.equal(spent.recovered, 0);
    assert.equal(total(), after_spend, 'spent stolen goods are not recreated');
});

test('one staffed civilian patrol pursues, arrests, escorts, jails and releases without teleporting or combat', () => {
    const { world, people } = setup();
    const [king, suspect, victim, witness, officer] = people;
    const c = reported_case(world, suspect, victim, { x: 56 });
    suspect.trait_ids = ['thief'];
    suspect.daily_life.phase = 'travel';
    suspect.daily_life.site = { kind: 'home', x: 50, y: 50 };
    suspect.daily_life.cargo.food = 1;
    officer.x = 50; officer.y = 50;
    assert.equal(king.id, world.villages[0].king_id);
    assert.ok(witness.id !== suspect.id);

    let saw_pursuit = false, saw_escort = false, saw_jail = false, moved = false;
    let previous = new Map([suspect, officer].map(person => [person.id, { x: person.x, y: person.y }]));
    for (let step = 0; step < 500 && c.status !== 'closed'; step++) {
        world.step(0.125);
        for (const person of [suspect, officer]) {
            const before = previous.get(person.id);
            const distance = Math.hypot(person.x - before.x, person.y - before.y);
            assert.ok(distance <= 0.25, `${person.name} moved ${distance} in one 0.125s step`);
            if (distance > 0.001) moved = true;
            previous.set(person.id, { x: person.x, y: person.y });
        }
        saw_pursuit ||= c.status === 'pursuit';
        saw_escort ||= c.status === 'escort';
        saw_jail ||= c.status === 'jailed';
        assert.equal(suspect.prisoner_of ?? null, null, 'civilian justice is not war captivity');
        assert.ok(!suspect.health_history?.some(entry => entry.cause === 'combat'));
    }
    assert.ok(world.justice.patrols.length >= 1, '12 residents support a staffed station');
    assert.equal(world.justice.patrols.length, 1, 'one patrol is staffed at this population');
    assert.ok(moved, 'officer and suspect move through the world');
    assert.ok(saw_pursuit && saw_escort && saw_jail,
        `case transitions were pursuit=${saw_pursuit}, escort=${saw_escort}, jailed=${saw_jail}`);
    assert.equal(c.status, 'closed');
    assert.match(c.outcome, /Released after serving/);
    assert.ok(c.recovered <= c.amount);
    assert.equal(suspect.prisoner_of ?? null, null);
    assert.equal(world.relations.length, 0);
});

test('unsafe detention, escort loss and a flooded station release civilians safely', () => {
    const build = status => {
        const { world, people } = setup();
        const [king, suspect, victim, witness, officer] = people;
        const c = reported_case(world, suspect, victim, { status, officer });
        return { world, c, suspect, officer, king, witness };
    };

    const weak = build('jailed');
    weak.suspect.health = creature_stats(weak.suspect, weak.world.year_length).max_health * 0.49;
    weak.world.step(0.125);
    assert.equal(weak.c.status, 'closed');
    assert.match(weak.c.outcome, /Released because safe detention/);
    assert.equal(weak.suspect.prisoner_of ?? null, null);

    const no_escort = build('escort');
    no_escort.officer.health = 0;
    no_escort.world.step(0.125);
    assert.equal(no_escort.c.status, 'closed');
    assert.match(no_escort.c.outcome, /escort became unavailable/);
    assert.equal(no_escort.suspect.prisoner_of ?? null, null);

    const flooded = build('jailed');
    flooded.world.set_tile(50, 50, T.OCEAN);
    flooded.world.step(0.125);
    assert.equal(flooded.c.status, 'closed');
    assert.match(flooded.c.outcome, /Released because safe detention/);
    assert.equal(flooded.suspect.prisoner_of ?? null, null);
});

test('pursuit, escort and jail saves resume deterministically', () => {
    for (const status of ['pursuit', 'escort', 'jailed']) {
        const { world, people } = setup();
        const [king, suspect, victim, witness, officer] = people;
        const c = reported_case(world, suspect, victim, { status, officer, x: 55 });
        suspect.daily_life.cargo.food = 1;
        if (status === 'escort') suspect.x = 53;
        if (status === 'jailed') { suspect.x = 50; suspect.y = 51; }
        if (status === 'jailed') c.remaining = 6;
        delete world.random; // Compare the continuous seeded world with one loaded copy.
        const encoded = world.serialize();
        const resumed = World.deserialize(encoded);
        assert.equal(resumed.justice.cases[0].status, status);
        assert.deepEqual(world.serialize(), resumed.serialize());
        for (let step = 0; step < 60; step++) {
            world.step(0.125); resumed.step(0.125);
            assert.deepEqual(world.serialize(), resumed.serialize(),
                `${status} continuous and loaded worlds match at step ${step + 1}`);
        }
        assert.equal(king.id, world.villages[0].king_id);
    }
});

test('older saves default justice state and malformed or duplicate cases and patrols are rejected', () => {
    const { world } = setup();
    const legacy = world.serialize(); delete legacy.justice;
    assert.deepEqual(World.deserialize(legacy).justice, empty_justice());

    const { world: with_case, people } = setup();
    const c = reported_case(with_case, people[1], people[2]);
    const duplicate_case = with_case.serialize(); duplicate_case.justice.cases.push(structuredClone(c));
    assert.throws(() => World.deserialize(duplicate_case), /valid Genesis Grove world file/);
    const malformed_case = with_case.serialize(); malformed_case.justice.cases[0].status = 'teleported';
    assert.throws(() => World.deserialize(malformed_case), /valid Genesis Grove world file/);

    const staffed = setup();
    for (let step = 0; step < 8; step++) staffed.world.step(0.125);
    assert.equal(staffed.world.justice.patrols.length, 1);
    const duplicate_patrol = staffed.world.serialize();
    duplicate_patrol.justice.patrols.push(structuredClone(duplicate_patrol.justice.patrols[0]));
    assert.throws(() => World.deserialize(duplicate_patrol), /valid Genesis Grove world file/);
});

test('justice summary and wellbeing are pure paused-world projections', () => {
    const { world, kingdom } = setup();
    world.step(0.125);
    const before = world.serialize();
    const summary = justice_summary(world, kingdom.id);
    assert.deepEqual(justice_summary(world, kingdom.id), summary);
    const wellbeing = kingdom_wellbeing(world, kingdom.id);
    assert.equal(wellbeing.police, summary.officers);
    assert.deepEqual(wellbeing.justice, summary);
    assert.deepEqual(world.serialize(), before, 'read-only projections do not advance or mutate the world');
    assert.equal(kingdom_wellbeing(world, -1), null);
    assert.equal(JUSTICE.cells, 4);
});

test('police coverage counts only owned patrols and homes within staffed-station service range', () => {
    const { world, kingdom, people } = setup();
    const officer = people.at(-1);
    const remote = world.found_colony(kingdom.id, 80, 50);
    kingdom.buildings.push({ type: 'police_station', x: 80, y: 50, growth: 1, harvests: 0 });
    assert.equal(world.add_person(80, 50, kingdom.id), true);
    const remote_resident = world.people.at(-1);
    remote_resident.home_id = remote.id;
    remote_resident.age = world.year_length * 24;
    world.justice.patrols = [{ officer_id: officer.id, kingdom_id: kingdom.id,
        x: 50, y: 50, target_x: 50, target_y: 50, timer: 0 }];

    const served = justice_summary(world, kingdom.id);
    assert.equal(served.stations, 2, 'the second station exists but has no officer');
    assert.equal(served.officers, 1);
    assert.equal(served.coverage, 92, 'the unstaffed remote station does not count as home coverage');

    const other = world.found_village(20, 80);
    officer.village_id = other.id;
    const reassigned = justice_summary(world, kingdom.id);
    assert.equal(reassigned.officers, 0, 'a patrol cannot count an officer assigned to another kingdom');
    assert.equal(reassigned.coverage, 0);
});

test('loaded police and jailed indexes exist before advancing and paused justice projections stay unchanged', () => {
    const { world, kingdom, people } = setup();
    const [king, suspect, victim, witness, officer] = people;
    const c = reported_case(world, suspect, victim, { status: 'jailed', officer, x: 50 });
    suspect.x = 50; suspect.y = 51; c.remaining = 5;
    const source_before = world.serialize();
    const source_summary = justice_summary(world, kingdom.id);
    const source_wellbeing = kingdom_wellbeing(world, kingdom.id);

    const loaded = World.deserialize(source_before);
    const loaded_before = loaded.serialize();
    assert.ok(loaded._police_ids.has(officer.id), 'loaded officer is indexed before the first simulation step');
    assert.equal(loaded._justice_custody.get(suspect.id)?.case.status, 'jailed');
    assert.ok(loaded._justice_custody.get(suspect.id)?.station);
    assert.ok(justice_busy(loaded, officer));
    assert.ok(justice_busy(loaded, suspect));
    assert.deepEqual(justice_summary(loaded, kingdom.id), source_summary);
    assert.deepEqual(kingdom_wellbeing(loaded, kingdom.id), source_wellbeing);
    assert.deepEqual(loaded.serialize(), loaded_before, 'paused projections do not mutate the loaded world');
    assert.deepEqual(world.serialize(), source_before, 'the source paused world remains unchanged');
    assert.equal(king.id, world.villages[0].king_id);
});
