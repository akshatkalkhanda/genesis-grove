import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_weather, spawn_weather, wave_reaches, MAX_WEATHER } from '../src/weather.js';

function coast() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'weather-coast' });
    for (let y = 15; y < 70; y++) for (let x = 40; x < 90; x++) world.set_tile(x, y, T.GRASS);
    return world;
}
function advance(world, seconds) {
    for (let t = 0; t < seconds; t += 0.125) { world.time += 0.125; advance_weather(world, 0.125); }
}

test('a tsunami needs deep ocean and a reachable nearby low coast', () => {
    const world = coast();
    assert.equal(world.apply('tsunami', 45, 35).ok, false);
    world.set_tile(35, 35, T.SHALLOW);
    assert.equal(world.apply('tsunami', 35, 35).ok, false);
    assert.equal(world.apply('tsunami', 30, 35).ok, true);
    const empty = new World({ preset: 'empty', inhabited: false });
    assert.equal(empty.apply('tsunami', 96, 64).ok, false);
});

test('the wave travels through water, damages low coast once and stops inland/high ground', () => {
    const world = coast();
    const kingdom = world.found_village(41, 35, 'human');
    world.add_person(41, 35, kingdom.id);
    const person = world.people[0]; person.x = 41; person.y = 35;
    kingdom.houses = [{ x: 41, y: 35 }, { x: 47, y: 35 }];
    const event = { x: 30, y: 35 };
    assert.equal(wave_reaches(world, event, 42, 35), true);
    assert.equal(wave_reaches(world, event, 44, 35), false);
    assert.equal(world.apply('tsunami', 30, 35).ok, true);
    advance(world, 5); assert.equal(person.health, 100);
    advance(world, 1); assert.equal(person.health, 62);
    assert.ok(person.health_history.some(h => h.cause === 'tsunami'));
    assert.equal(kingdom.houses.some(h => h.x === 41), false);
    assert.equal(kingdom.houses.some(h => h.x === 47), true);
    advance(world, 2); assert.equal(person.health, 62);
    assert.equal(world.tile(41, 35), T.GRASS); // Receding water does not permanently turn land into ocean.
    world.set_tile(40, 35, T.HILL);
    assert.equal(wave_reaches(world, event, 41, 35), false);
});

test('rain restores soil and quenches fire while drought damages actual crop growth', () => {
    const world = coast(), index = world.index(50, 35);
    world.fertility[index] = 0.2; world.fire[index] = 15;
    spawn_weather(world, 'raincloud', 50, 35); advance(world, 1);
    assert.equal(world.fire[index], 0); assert.ok(world.fertility[index] > 0.2);
    world.weather = [];
    const kingdom = world.found_village(50, 35, 'human');
    kingdom.buildings = [{ type: 'farm', x: 50, y: 35, growth: 0.8 }];
    spawn_weather(world, 'drought', 50, 35); advance(world, 1);
    assert.ok(kingdom.buildings[0].growth < 0.8);
    assert.ok(world.fertility[index] < 0.23);
});

test('blizzards hurt exposed citizens more than sheltered citizens and record a cause', () => {
    const world = coast(), kingdom = world.found_village(50, 35, 'human');
    world.add_person(50, 35, kingdom.id); world.add_person(55, 35, kingdom.id);
    const [inside, outside] = world.people;
    inside.x = 50; inside.y = 35; outside.x = 55; outside.y = 35;
    kingdom.houses = [{ x: 50, y: 35 }];
    spawn_weather(world, 'blizzard', 50, 35, 10); advance(world, 1);
    assert.ok(inside.health > outside.health);
    assert.equal(outside.health_history[0].cause, 'cold');
});

test('a storm produces actual lightning rather than only a weather animation', () => {
    const world = coast();
    world.apply('storm', 50, 35); advance(world, 6);
    assert.ok(world.events.some(e => e.text.includes('Thunder breaks')));
    assert.ok(world.effects.some(e => e.type === 'lightning'));
});

test('weather state continues identically after save/load and old worlds receive quiet defaults', () => {
    const world = coast();
    world.apply('storm', 50, 35); world.apply('tsunami', 30, 35); advance(world, 3.375);
    const restored = World.deserialize(world.serialize());
    advance(world, 4); advance(restored, 4);
    assert.deepEqual(restored.serialize(), world.serialize());
    const legacy = world.serialize(); delete legacy.weather; delete legacy.weather_clock; delete legacy.laws.natural_events;
    const old = World.deserialize(legacy);
    assert.deepEqual(old.weather, []); assert.equal(old.weather_clock, 0); assert.equal(old.laws.natural_events, false);
});

test('active event count, import fields and automatic event rules are bounded', () => {
    const world = coast();
    for (let i = 0; i < MAX_WEATHER; i++) assert.equal(world.apply('raincloud', 50, 35).ok, true);
    assert.equal(world.apply('storm', 50, 35).ok, false);
    const good = world.serialize();
    for (const change of [e => { e.kind = '__proto__'; }, e => { e.x = Infinity; },
        e => { e.radius = 500; }, e => { e.age = -1; }, e => { e.timer = 3; }]) {
        const bad = structuredClone(good); change(bad.weather[0]);
        assert.throws(() => World.deserialize(bad));
    }
    world.weather = []; advance(world, 91); assert.equal(world.weather.length, 0);
    world.laws.natural_events = true;
    // All land guarantees a suitable non-tsunami automatic event with this seed.
    world.tiles.fill(T.GRASS); world.rng = 42; world.weather_clock = 89.875;
    advance(world, 0.125); assert.equal(world.weather.length, 1);
    world.laws.natural_events = false;
    advance(world, 31); assert.equal(world.weather.length, 0);
});

test('a live world with mixed hazards can be saved and resumed through the normal simulation step', () => {
    const world = coast();
    const kingdom = world.found_village(44, 35, 'human');
    for (let i = 0; i < 8; i++) world.add_person(44 + i % 3, 35 + i % 2, kingdom.id);
    world.apply('storm', 46, 35); world.apply('tsunami', 30, 35);
    world.apply('blizzard', 55, 35); world.apply('drought', 60, 35);
    for (let i = 0; i < 37; i++) world.step(0.125);
    const restored = World.deserialize(world.serialize());
    for (let i = 0; i < 80; i++) { world.step(0.125); restored.step(0.125); }
    assert.deepEqual(restored.serialize(), world.serialize());
    assert.doesNotThrow(() => World.deserialize(world.serialize()));
});
