import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, HEIGHT } from '../src/simulation.js';
import { advance_funerals, FUNERALS, funeral_intent, prepare_funerals,
    record_death } from '../src/funerals.js';
import { apply_damage } from '../src/health.js';

function setup() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'funeral-lifecycle' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(60, 60);
    const add_adult = (x = home.x, y = home.y) => {
        world.add_person(x, y, home.id);
        const person = world.people.at(-1);
        person.age = 24 * world.year_length;
        person.health = 100;
        person.needs.nutrition = 100; person.needs.energy = 100;
        return person;
    };
    const kill = (person, cause = 'fire') => {
        apply_damage(world, person, 200, cause);
        world.clean_up();
        return world.remains.find(body => body.id === person.id);
    };
    return { world, home, add_adult, kill };
}

test('death creates one finite local body and preserves a death record without duplicating it', () => {
    const { world, home, add_adult, kill } = setup();
    const dead = add_adult(61, 60), id = dead.id;
    const body = kill(dead);
    assert.ok(body);
    assert.equal(body.id, id);
    assert.equal(body.cause, 'fire');
    assert.equal(body.age_years, 24);
    assert.equal(body.stage, 'waiting');
    assert.equal(body.carrier_id, null);
    assert.equal(world.people.some(person => person.id === id), false);
    assert.equal(world.remains.length, 1);
    assert.equal(world.cemeteries.length, 1);
    assert.equal(world.cemeteries[0].kingdom_id, home.id);
    world.clean_up();
    record_death(world, dead);
    assert.equal(world.remains.length, 1);
    assert.equal(world.cemeteries[0].records.length, 0);
});

test('erased people leave no body; a death over water becomes a lost memorial', () => {
    const { world, home, add_adult, kill } = setup();
    const erased = add_adult(61, 60);
    apply_damage(world, erased, 200, 'erase');
    world.clean_up();
    assert.equal(world.remains.length, 0);

    const drowned = add_adult(64, 60);
    world.set_tile(64, 60, T.OCEAN);
    const record = kill(drowned);
    assert.equal(record, undefined);
    const cemetery = world.cemeteries.find(item => item.kingdom_id === home.id);
    assert.ok(cemetery);
    assert.equal(cemetery.unrecovered, 1);
    assert.equal(cemetery.records[0].method, 'lost');
    assert.equal(cemetery.records[0].id, drowned.id);
});

test('only a healthy adult civilian of the same kingdom can carry remains', () => {
    const { world, home, add_adult, kill } = setup();
    const worker = add_adult(61, 60);
    const dead = add_adult(62, 60);
    const body = kill(dead);
    world.tick = 8;
    prepare_funerals(world);
    assert.equal(body.carrier_id, worker.id);

    body.carrier_id = null;
    const child = add_adult(61, 60); child.age = 10 * world.year_length;
    world.people = [child];
    world.tick = 16;
    prepare_funerals(world);
    assert.equal(body.carrier_id, null, 'a child cannot take the funeral assignment');

    const foreign = world.found_village(80, 60);
    world.add_person(80, 60, foreign.id);
    const stranger = world.people.at(-1); stranger.age = 24 * world.year_length;
    stranger.needs.nutrition = 100; stranger.needs.energy = 100;
    world.people = [stranger]; world.tick = 24;
    prepare_funerals(world);
    assert.equal(body.carrier_id, null, 'a different kingdom cannot take the body');
    assert.equal(home.id, body.kingdom_id);
});

test('an unreachable body is never teleported to a cemetery', () => {
    const { world, add_adult, kill } = setup();
    const worker = add_adult(61, 60);
    const dead = add_adult(70, 60);
    const body = kill(dead);
    const old_position = { x: body.x, y: body.y };
    for (let y = 0; y < HEIGHT; y++) world.set_tile(65, y, T.OCEAN);
    world.tick = 8;
    prepare_funerals(world);
    assert.equal(body.carrier_id, null);
    assert.deepEqual({ x: body.x, y: body.y }, old_position);
    assert.ok(worker.health > 50);
});

test('a submerged cemetery keeps its saved location and delays new funerals until reachable', () => {
    const { world, add_adult, kill } = setup();
    add_adult(61, 60);
    kill(add_adult(62, 60));
    const cemetery = world.cemeteries[0];
    const position = { x: cemetery.x, y: cemetery.y };
    world.set_tile(Math.floor(cemetery.x), Math.floor(cemetery.y), T.OCEAN);
    const body = kill(add_adult(63, 60));
    assert.ok(body);
    assert.equal(world.cemeteries.length, 1);
    assert.deepEqual({ x: cemetery.x, y: cemetery.y }, position,
        'the cemetery is never silently moved to another plot');
    world.tick = 8;
    prepare_funerals(world);
    assert.equal(body.carrier_id, null, 'workers wait while the plot is submerged');
    assert.deepEqual(World.deserialize(world.serialize()).cemeteries[0], cemetery);
});

test('burial completes at the cemetery once and remains saved during the journey', () => {
    const { world, home, add_adult, kill } = setup();
    const worker = add_adult(61, 60), dead = add_adult(62, 60);
    const body = kill(dead);
    const cemetery = world.cemeteries[0];
    worker.x = cemetery.x; worker.y = cemetery.y;
    body.carrier_id = worker.id; body.stage = 'rites'; body.x = cemetery.x; body.y = cemetery.y;
    world._funeral_assignments = new Map([[worker.id, body]]);
    funeral_intent(world, worker, FUNERALS.burial_seconds - 0.1);
    assert.equal(body.timer, FUNERALS.burial_seconds - 0.1);
    const resumed = World.deserialize(world.serialize());
    const saved_worker = resumed.people.find(person => person.id === worker.id);
    prepare_funerals(resumed);
    funeral_intent(resumed, saved_worker, 0.1);
    const saved_cemetery = resumed.cemeteries[0];
    assert.equal(resumed.remains.length, 0);
    assert.equal(saved_cemetery.buried, 1);
    assert.equal(saved_cemetery.cremated, 0);
    assert.equal(saved_cemetery.records[0].method, 'burial');
    funeral_intent(resumed, saved_worker, 5);
    assert.equal(saved_cemetery.buried, 1, 'a completed record cannot be counted twice');
    assert.equal(home.wood, resumed.villages[0].wood);
});

test('a real World step carries and buries a nearby body without inventing timber', () => {
    const { world, home, add_adult, kill } = setup();
    const worker = add_adult(61, 60);
    home.food = 1000; home.wood = 0; home.funeral_method = 'burial';
    const dead = add_adult(62, 60);
    kill(dead);
    world.tick = 7;
    for (let step = 0; step < 160 && world.remains.length; step++) world.step(0.125);
    assert.equal(world.remains.length, 0, 'the nearby adult completes the automatic funeral');
    assert.equal(world.cemeteries[0].buried, 1);
    assert.equal(world.cemeteries[0].records[0].id, dead.id);
    assert.equal(home.wood, 0);
    assert.ok(world.people.some(person => person.id === worker.id && person.health > 50));
});

test('cremation charges two timber once, persists payment, then records the rite once', () => {
    const { world, home, add_adult, kill } = setup();
    const worker = add_adult(61, 60), dead = add_adult(62, 60);
    const body = kill(dead), cemetery = world.cemeteries[0];
    home.funeral_method = 'cremation'; home.wood = FUNERALS.cremation_wood;
    worker.x = cemetery.x; worker.y = cemetery.y;
    body.carrier_id = worker.id; body.stage = 'rites'; body.x = cemetery.x; body.y = cemetery.y;
    world._funeral_assignments = new Map([[worker.id, body]]);
    const original_wood = home.wood;
    funeral_intent(world, worker, 1);
    assert.equal(home.wood, original_wood - FUNERALS.cremation_wood);
    assert.equal(body.paid, true);
    const resumed = World.deserialize(world.serialize());
    const saved_worker = resumed.people.find(person => person.id === worker.id);
    prepare_funerals(resumed);
    funeral_intent(resumed, saved_worker, FUNERALS.cremation_seconds - 1);
    assert.equal(resumed.remains.length, 0);
    assert.equal(resumed.villages[0].wood, 0);
    assert.equal(resumed.cemeteries[0].cremated, 1);
    assert.equal(resumed.cemeteries[0].records[0].method, 'cremation');
    assert.equal(resumed.cemeteries[0].records[0].id, dead.id);
});

test('decay records remains as unrecovered; pause and legacy saves preserve safe defaults', () => {
    const { world, add_adult, kill } = setup();
    const body = kill(add_adult(62, 60));
    body.age = FUNERALS.decay_seconds - 0.1;
    const frozen = world.serialize();
    advance_funerals(world, 0);
    assert.deepEqual(world.serialize(), frozen);
    advance_funerals(world, 0.1);
    assert.equal(world.remains.length, 0);
    assert.equal(world.cemeteries[0].unrecovered, 1);
    assert.equal(world.cemeteries[0].records[0].method, 'lost');
    const legacy = world.serialize();
    delete legacy.remains; delete legacy.cemeteries;
    for (const village of legacy.villages) delete village.funeral_method;
    const restored = World.deserialize(legacy);
    assert.deepEqual(restored.remains, []);
    assert.deepEqual(restored.cemeteries, []);
});

test('funeral data rejects invalid lifecycle, ownership, payment, and duplicate identities', () => {
    const { world, add_adult, kill } = setup();
    const body = kill(add_adult(62, 60));
    const valid = world.serialize();
    const mutations = [
        data => { data.remains[0].age = Infinity; },
        data => { data.remains[0].stage = 'teleport'; },
        data => { data.remains[0].carrier_id = data.remains[0].id; },
        data => { data.remains[0].paid = true; },
        data => { data.remains[0].kingdom_id = 999999; },
        data => { data.remains.push({ ...data.remains[0] }); },
        data => { data.cemeteries[0].records.push({ id: body.id, name: body.name,
            race: body.race, age_years: body.age_years, cause: body.cause, method: 'burial', year: 0 }); },
        data => { data.villages[0].funeral_method = 'teleport'; }
    ];
    for (const mutate of mutations) {
        const invalid = structuredClone(valid); mutate(invalid);
        assert.throws(() => World.deserialize(invalid));
    }
});
