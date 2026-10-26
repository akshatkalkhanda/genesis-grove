import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { kingdom_wellbeing, WELLBEING } from '../src/kingdom_wellbeing.js';

function setup() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'wellbeing-estimate' });
    world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(60, 60);
    kingdom.houses = [{ x: 60, y: 60 }];
    const add_person = (age = 24) => {
        world.add_person(60, 60, kingdom.id);
        const person = world.people.at(-1);
        person.age = age * world.year_length;
        person.health = creature_stats(person, world.year_length).max_health;
        person.needs.nutrition = 70;
        return person;
    };
    return { world, kingdom, add_person };
}

test('wellbeing uses the declared food, housing, health, and safety weights', () => {
    const { world, kingdom, add_person } = setup();
    const person = add_person();
    const healthy = kingdom_wellbeing(world, kingdom.id);
    assert.deepEqual([healthy.happiness, healthy.happy, healthy.happy_percent], [100, 1, 100]);
    assert.deepEqual([healthy.beds, healthy.housed, healthy.homeless], [WELLBEING.beds_per_house, 1, 0]);

    person.health = creature_stats(person, world.year_length).max_health * 0.5;
    person.needs.nutrition = 35;
    person.health_history = [{ cause: 'combat', time: world.time }];
    const affected = kingdom_wellbeing(world, kingdom.id);
    assert.equal(affected.happiness, 58);
    assert.equal(affected.happy_percent, 0);
    assert.equal(affected.hungry, 1);
    assert.equal(affected.injured, 1);
});

test('five beds per house are allocated across the capital and its colonies', () => {
    const { world, kingdom, add_person } = setup();
    const colony = { id: world.next_id++, kingdom_id: kingdom.id, x: 80, y: 60,
        houses: [{ x: 80, y: 60 }], buildings: [] };
    world.colonies.push(colony);
    for (let index = 0; index < 11; index++) {
        const person = add_person();
        person.home_id = index < 6 ? kingdom.id : colony.id;
    }
    const m = kingdom_wellbeing(world, kingdom.id);
    assert.equal(m.beds, 10);
    assert.equal(m.housed, 10);
    assert.equal(m.homeless, 1);
    assert.equal(m.homeless_percent, 9);
});

test('service counts reflect school attendance, health staff, detention, and active buildings', () => {
    const { world, kingdom, add_person } = setup();
    const school = { type: 'school', x: 60, y: 60 };
    kingdom.buildings = [school, { type: 'well', x: 60, y: 60 },
        { type: 'clinic', x: 60, y: 60 }, { type: 'hospital', x: 60, y: 60 },
        { type: 'prison', x: 60, y: 60 }];
    const attending = add_person(12);
    attending.daily_life = { phase: 'work', site: { kind: 'school', x: 60, y: 60 } };
    const absent = add_person(12);
    absent.daily_life = { phase: 'travel', site: { kind: 'school', x: 60, y: 60 } };
    const doctor = add_person(); doctor.medical_role = 'doctor';
    const sick = add_person(); sick.infection = 1;
    const prisoner = add_person(); prisoner.prisoner_of = kingdom.id;
    world.armies = [{ kingdom_id: kingdom.id }];
    const m = kingdom_wellbeing(world, kingdom.id);
    assert.deepEqual([m.schools, m.school_age, m.attending], [1, 2, 1]);
    assert.deepEqual([m.wells, m.clinics, m.hospitals, m.medical_staff], [1, 1, 1, 1]);
    assert.deepEqual([m.sick, m.prisons, m.prison_capacity, m.prisoners, m.garrisons], [1, 1, 8, 1, 1]);
});

test('unmodeled services remain unknown instead of being reported as zero', () => {
    const { world, kingdom } = setup();
    const m = kingdom_wellbeing(world, kingdom.id);
    for (const key of ['tax_rate', 'tax_collected', 'drinking_water', 'clothing', 'clean_air', 'police', 'advocates', 'courts']) {
        assert.equal(m[key], null, `${key} is not modeled`);
    }
    assert.equal(kingdom_wellbeing(world, -1), null);
});

test('repeated estimates do not mutate the world and legacy saves receive safe defaults', () => {
    const { world, kingdom, add_person } = setup();
    add_person();
    const before = world.serialize();
    const first = kingdom_wellbeing(world, kingdom.id);
    const second = kingdom_wellbeing(world, kingdom.id);
    assert.deepEqual(second, first);
    assert.deepEqual(world.serialize(), before);
    const legacy = structuredClone(before);
    delete legacy.remains; delete legacy.cemeteries;
    for (const village of legacy.villages) delete village.funeral_method;
    const restored = World.deserialize(legacy);
    assert.ok(kingdom_wellbeing(restored, kingdom.id));
});
