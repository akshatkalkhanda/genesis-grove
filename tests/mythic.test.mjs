import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';

test('angels heal and extinguish fire while demons attack and can be banished', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    world.add_person(50, 50); world.people[0].health = 50;
    world.add_animal(51, 50, 'angel');
    world.fire[world.index(50, 50)] = 10;
    world.step(0.125);
    assert.ok(world.people[0].health > 50);
    assert.equal(world.fire[world.index(50, 50)], 0);
    assert.equal(world.animals[0].health, 250);
    world.add_animal(52, 50, 'demon');
    const demon = world.animals.at(-1), guardian = world.animals[0];
    for (let step = 0; step < 4; step++) world.step(0.125);
    assert.ok(demon.health < 300);
    assert.ok(guardian.health < 250);
    assert.ok(world.animals[0].task.includes('Banishing'));
    assert.deepEqual(World.deserialize(world.serialize()).animals, world.animals);
});

test('an unopposed demon attacks villagers and starts a fire', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    world.add_person(50, 50); world.add_animal(51, 50, 'demon');
    const victim = world.people[0];
    world.step(0.125);
    assert.ok(victim.health < 100);
    assert.ok(world.fire.some(value => value > 0));
    assert.equal(world.animals[0].task, 'Hunting villagers');
});

test('mythical creatures can fly over water and survive terrain changes', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    world.add_animal(50, 50, 'angel');
    world.set_tile(50, 50, T.OCEAN); world.clean_up();
    assert.equal(world.animals.length, 1);
    world.step(0.125);
    assert.ok(world.animals[0].health > 0);
});
