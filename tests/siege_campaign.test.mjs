import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, HEIGHT } from '../src/simulation.js';

function campaign() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'siege-arrival' });
    world.tiles.fill(T.GRASS);
    for (const law of Object.keys(world.laws)) world.laws[law] = false;
    const home = world.found_village(35, 55), enemy = world.found_village(120, 55);
    home.food = 10000; enemy.food = 10000;
    const town = world.found_colony(enemy.id, 75, 55);
    for (let i = 0; i < 4; i++) {
        world.add_person(home.x + i * 0.2, home.y, home.id);
        world.people.at(-1).role = 'soldier';
    }
    world.add_person(enemy.x, enemy.y, enemy.id);
    world.set_relation(home.id, enemy.id, 'war');
    return { world, home, enemy, town };
}

test('a campaign marches to a town, builds pressure there and resumes deterministically', () => {
    const { world, home, town } = campaign();
    const original_ids = new Set(world.people.map(person => person.id));
    let arrival_time = null, checkpoint = null;
    for (let i = 0; i < 1600 && town.kingdom_id !== home.id; i++) {
        world.step(0.125);
        const nearby = world.people.filter(person => person.village_id === home.id
            && person.role === 'soldier' && Math.hypot(person.x - town.x, person.y - town.y) <= 6);
        if (nearby.length < 2 && arrival_time === null) assert.equal(town.siege, 0);
        if (nearby.length >= 2 && arrival_time === null) arrival_time = world.time;
        if (town.siege > 0 && !checkpoint) checkpoint = world.serialize();
    }
    assert.ok(arrival_time > 1, 'The army must travel from its actual home');
    assert.ok(checkpoint, 'A siege has a saveable intermediate state');
    assert.equal(town.kingdom_id, home.id);
    assert.ok(world.time - arrival_time >= 10, 'Numerical advantage cannot capture instantly');
    assert.ok([...original_ids].every(id => world.people.some(person => person.id === id)),
        'The campaign keeps the existing population');
    const first = World.deserialize(checkpoint);
    assert.deepEqual(first.serialize(), checkpoint, 'Load preserves the exact campaign checkpoint');
    for (let i = checkpoint.tick; i < world.tick; i++) first.step(0.125);
    assert.deepEqual(first.serialize(), world.serialize(),
        'Save/resume must match the campaign that continued without reloading');
    assert.equal(first.colonies.find(site => site.id === town.id).kingdom_id, home.id);
});

test('an ocean barrier prevents a campaign from accumulating remote siege pressure', () => {
    const { world, home, town } = campaign();
    for (let y = 0; y < HEIGHT; y++) world.tiles[world.index(60, y)] = T.OCEAN;
    for (let i = 0; i < 160; i++) world.step(0.125);
    assert.equal(town.siege, 0);
    assert.notEqual(town.kingdom_id, home.id);
    assert.ok(world.people.filter(person => person.village_id === home.id)
        .every(person => person.x < 60));
    assert.ok(world.army_orders.every(order => order.state !== 'attack'));
});
