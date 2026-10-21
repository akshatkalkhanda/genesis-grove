import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { apply_damage, health_risks } from '../src/health.js';
import { advance_buildings } from '../src/settlements.js';

function ward(type = 'clinic', stock = 10) {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    kingdom.houses = [{ x: 50, y: 50 }, { x: 49, y: 50 }];
    for (let i = 0; i < 8; i++) { world.add_person(52, 50, kingdom.id); world.people.at(-1).gather = 0; }
    kingdom.food = 100; kingdom.wood = 0;
    const clinic = { type, x: 52, y: 50, growth: 0, harvests: 0, stock };
    kingdom.buildings = [clinic, { type: 'camp', x: 56, y: 50, growth: 0, harvests: 0 }];
    const patient = world.people[2]; patient.role = 'soldier'; patient.health = 20;
    return { world, kingdom, clinic, patient };
}

test('clinics and hospitals construct at their population and technology gates', () => {
    const { world, kingdom } = ward();
    kingdom.buildings = []; kingdom.wood = 1000; kingdom.food = 1000;
    for (let i = 0; i < 8; i++) advance_buildings(world, kingdom, 12, 40, 0);
    assert.ok(kingdom.buildings.some(b => b.type === 'clinic'));
    assert.ok(!kingdom.buildings.some(b => b.type === 'hospital'));
    for (let i = 0; i < 20; i++) advance_buildings(world, kingdom, 12, 40, 5);
    assert.ok(kingdom.buildings.some(b => b.type === 'hospital'));
});

test('injured soldiers leave training for staffed care that consumes supplies and cures infection', () => {
    const { world, kingdom, clinic, patient } = ward();
    patient.infection = 0.5;
    const food = kingdom.food;
    world.step(0.25);
    assert.equal(patient.task, 'Receiving treatment');
    assert.equal(patient.recovering, true);
    assert.ok(world.people.some(p => p.medical_role === 'doctor'));
    assert.ok(clinic.stock < 10 && kingdom.food < food);
    assert.ok(patient.infection < 0.5 - 0.25 * 0.025);
    assert.ok(patient.health_history.some(e => e.cause === 'infection'));
    patient.infection = 0;
    for (let i = 0; i < 250; i++) world.step(0.25);
    assert.ok(clinic.treatments >= 1);
    assert.equal(patient.recovering, false);
    assert.equal(patient.task, 'Training');
});

test('doctors gather finite herbs and return them, while unstaffed clinics cannot treat', () => {
    const { world, clinic, patient } = ward('clinic', 0);
    for (const p of world.people) { p.x = 52.5; p.y = 50.5; }
    const soil = world.fertility[world.index(52, 50)];
    for (let i = 0; i < 56; i++) world.step(0.25);
    assert.ok(clinic.stock > 0 && clinic.stock <= 3);
    assert.ok(world.fertility[world.index(52, 50)] < soil);
    assert.ok(patient.health > 20);
    const unstaffed = ward();
    for (const p of unstaffed.world.people) if (p !== unstaffed.patient) p.age = 10 * unstaffed.world.year_length;
    unstaffed.world.step(0.25);
    assert.ok(!unstaffed.world.people.some(p => p.medical_role));
    assert.equal(unstaffed.clinic.stock, 10);
    assert.equal(unstaffed.patient.task, 'Waiting for treatment');
});

test('treatment requires food, supply and a physically present healthy doctor', () => {
    const missing_food = ward(); missing_food.kingdom.food = 0;
    const missing_stock = ward('clinic', 0);
    const distant = ward();
    for (const p of distant.world.people) if (p !== distant.patient) { p.x = 80; p.y = 80; }
    for (const state of [missing_food, missing_stock, distant]) {
        const stock = state.clinic.stock;
        state.world.step(0.25);
        assert.notEqual(state.patient.task, 'Receiving treatment');
        assert.equal(state.clinic.stock, stock);
    }
});

test('island patients recover at home instead of trying to walk across the sea', () => {
    const { world, patient } = ward();
    for (let y = 0; y < 128; y++) world.tiles[world.index(51, y)] = T.OCEAN;
    patient.x = 49; patient.y = 50;
    world.step(0.25);
    assert.equal(patient.task, 'Recovering at home');
    assert.ok(world.people.filter(p => p.medical_role).every(p => p.x > 51));
});

test('hungry civilians resume gathering when a foodless clinic cannot treat starvation', () => {
    const { world, kingdom, patient } = ward();
    patient.role = 'civilian'; patient.job = 'farmer';
    kingdom.food = 0;
    apply_damage(world, patient, 1, 'starvation');
    patient.gather = 3;
    world.step(0.25);
    assert.equal(patient.recovering, false);
    assert.notEqual(patient.task, 'Waiting for treatment');
    assert.ok(kingdom.food > 0);
});

test('clinics and hospitals receive distinct staff and a full cabinet cannot deadlock treatment', () => {
    const { world, kingdom, clinic, patient } = ward();
    for (let i = 0; i < 8; i++) world.add_person(60, 50, kingdom.id);
    const hospital = { type: 'hospital', x: 60, y: 50, growth: 0, harvests: 0, stock: 20 };
    kingdom.buildings.push(hospital);
    const builders = world.people.filter(p => p.job === 'builder');
    builders[0].x = 52;
    for (const builder of builders.slice(1)) builder.x = 60;
    patient.x = 60;
    world.step(0.25);
    const staff = [...world._medical_doctors.values()];
    assert.equal(staff.filter(site => site === clinic).length, 1);
    assert.equal(staff.filter(site => site === hospital).length, 2);
    assert.equal(patient.task, 'Receiving treatment');
    assert.ok(hospital.stock < 20);
    const solo = ward(); solo.clinic.stock = 120;
    const doctor = solo.world.people.find(p => p.job === 'builder');
    doctor.medical_work = { timer: 0, cargo: 3, source: null };
    solo.world.step(0.25);
    assert.equal(solo.patient.task, 'Receiving treatment');
    assert.equal(doctor.medical_work.cargo, 3);
    assert.ok(solo.clinic.stock < 120);
});

test('age-related decline continues during care and dead patients cannot be revived', () => {
    const young = ward(), old = ward();
    old.patient.age = 110 * old.world.year_length;
    old.patient.health = 100;
    const before = old.patient.health;
    old.world.step(0.25); young.world.step(0.25);
    assert.ok(old.patient.health < before);
    assert.ok(old.patient.health_history.some(e => e.cause === 'aging'));
    const dead = ward(); dead.patient.health = 0;
    dead.world.step(0.25);
    assert.equal(dead.patient.health, 0);
    assert.equal(dead.clinic.stock, 10);
});

test('damage reasons are real events, bounded, and preserved with medical state in saves', () => {
    const { world, patient } = ward();
    patient.health = creature_stats(patient, world.year_length).max_health;
    apply_damage(world, patient, 6, 'combat'); apply_damage(world, patient, 4, 'combat');
    assert.equal(patient.health_history.length, 1);
    assert.equal(patient.health_history[0].amount, 10);
    for (let i = 0; i < 12; i++) { world.time += 4; apply_damage(world, patient, 0.1, 'fire'); }
    assert.equal(patient.health_history.length, 8);
    patient.infection = 0.2; patient.age = 90 * world.year_length;
    world.fire[world.index(patient.x, patient.y)] = 1;
    assert.deepEqual(health_risks(world, patient, world.villages[0]), ['Infected', 'Burning', 'Age-related decline']);
    const data = world.serialize();
    assert.deepEqual(World.deserialize(data).people, world.people);
    for (const change of [p => { p.health_history[0].cause = 'invented'; },
        p => { p.health_history[0].time = world.time + 1; },
        p => { p.medical_role = 'wizard'; },
        p => { p.medical_work = { timer: 1, cargo: 4, source: null }; }]) {
        const corrupt = structuredClone(data); change(corrupt.people.find(p => p.id === patient.id));
        assert.throws(() => World.deserialize(corrupt), /valid Genesis/);
    }
    const legacy = structuredClone(data);
    for (const p of legacy.people) { delete p.health_history; delete p.recovering; delete p.medical_role; delete p.medical_work; }
    assert.ok(World.deserialize(legacy));
});

test('actual hunger, fire and old age record causes instead of inferring from a low bar', () => {
    const { world, kingdom, patient } = ward();
    kingdom.buildings = []; kingdom.food = 0; world.fertility.fill(0);
    patient.gather = 3;
    world.step(0.125);
    assert.ok(patient.health_history.some(e => e.cause === 'starvation'));
    patient.age = 90 * world.year_length; patient.infection = 1;
    world.fire[world.index(patient.x, patient.y)] = 1;
    world.step(0.125);
    for (const cause of ['infection', 'fire', 'aging']) assert.ok(patient.health_history.some(e => e.cause === cause));
});
