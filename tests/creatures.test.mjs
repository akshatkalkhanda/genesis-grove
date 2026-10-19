import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats, develop_creature } from '../src/creatures.js';

test('age and earned experience raise health capacity, strength, and intelligence', () => {
    const unit = { id: 1, age: 0, health: 100 };
    develop_creature(unit, 15 * 20, 20);
    const young = creature_stats(unit, 20);
    develop_creature(unit, 35 * 20, 20);
    const older = creature_stats(unit, 20);
    assert.ok(young.max_health > 100);
    assert.ok(older.max_health > young.max_health);
    assert.ok(older.strength > young.strength);
    assert.ok(older.intelligence > young.intelligence);
    assert.equal(unit.health, older.max_health);
    const prior = older.level;
    develop_creature(unit, 0, 20, 1000);
    assert.ok(creature_stats(unit).level > prior);
});

test('older saves gain identity and lifetime XP while keeping their actual health', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS); world.add_person(40, 40);
    const saved = world.serialize();
    const person = saved.people[0]; person.age = 60 * 20;
    for (const key of ['name', 'xp', 'trait', 'parents', 'kills']) delete person[key];
    const restored = World.deserialize(saved);
    assert.equal(restored.people[0].health, 100);
    assert.ok(restored.people[0].name);
    assert.ok(creature_stats(restored.people[0]).max_health > 200);
    assert.deepEqual(World.deserialize(restored.serialize()).serialize(), restored.serialize());
    saved.people[0].health = 2000;
    assert.throws(() => World.deserialize(saved), /valid Genesis/);
});
