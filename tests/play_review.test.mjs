import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { initialize_daily_life, advance_daily_life, collect_daily_goods } from '../src/daily_life.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'review-child' });
    world.tiles.fill(T.GRASS); world.fertility.fill(1);
    const home = world.found_village(40, 50);
    world.add_person(40, 50, home.id);
    home.houses = [{ x: 40, y: 50 }];
    return { world, home, person: world.people[0] };
}

test('children cannot create subsistence or harvest goods, even with legacy adult work state', () => {
    const { world, home, person } = fixture();
    const farm = { type: 'farm', x: 40, y: 50, growth: 0, harvests: 0, stock: 12 };
    home.buildings = [farm]; person.job = 'farmer';
    const state = initialize_daily_life(person);
    state.phase = 'work'; state.site = { x: 40, y: 50, kind: 'farm' };
    for (const years of [0, 4, 17]) {
        person.age = years * world.year_length;
        assert.deepEqual(collect_daily_goods(world, person, home, 10, 10), { food: 0, wood: 0 });
        assert.deepEqual(state.cargo, { food: 0, wood: 0 });
        assert.equal(farm.stock, 12);
    }
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(state.site.kind, 'home');
    assert.equal(person.task, 'Learning and playing');
    person.age = 18 * world.year_length;
    state.site = { x: 40, y: 50, kind: 'farm' }; state.phase = 'work';
    assert.ok(collect_daily_goods(world, person, home, 10, 0).food > 0);
    assert.equal(farm.stock, 8);
});

test('infants remain at home while school-age children learn; returns never claim an adult delivery', () => {
    const { world, home, person } = fixture();
    home.buildings = [{ type: 'school', x: 43, y: 50 }];
    const state = initialize_daily_life(person);
    person.age = 0;
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(state.site.kind, 'home');
    person.age = 6 * world.year_length; state.phase = 'travel'; state.site = null;
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(state.site.kind, 'school'); assert.equal(person.task, 'Going to school');
    state.phase = 'return'; person.x = 45;
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(person.task, 'Returning home');
});

test('a real World step grants no child production XP or food, and old carried goods remain finite', () => {
    const { world, home, person } = fixture();
    person.age = 4 * world.year_length; person.gather = 3;
    person.needs.nutrition = 100; home.food = 20;
    const xp = person.xp;
    world.step(0.125);
    assert.equal(home.food, 20);
    assert.ok(Math.abs(person.xp - xp - 0.125 / world.year_length * 2) < 1e-8);
    const state = initialize_daily_life(person);
    state.phase = 'return'; state.cargo = { food: 2, wood: 1 };
    const before = { food: home.food, wood: home.wood };
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(home.food, before.food + 2); assert.equal(home.wood, before.wood + 1);
    assert.deepEqual(state.cargo, { food: 0, wood: 0 });
    advance_daily_life(world, person, home, home, 0.125, 100);
    assert.equal(home.food, before.food + 2);
    for (let i = 0; i < 120; i++) world.step(0.125);
    assert.equal(person.gather, 0, 'child gathering timers stay inside the save schema');
    assert.deepEqual(World.deserialize(world.serialize()).serialize(), world.serialize());
});

test('a disconnected soldier does not freeze reachable members returning home', () => {
    const { world, home, person } = fixture();
    for (let y = 0; y < 128; y++) world.set_tile(75, y, T.OCEAN);
    person.role = 'soldier'; person.age = 25 * world.year_length;
    person.x = 50; person.y = 50; person.trait_ids = []; person.needs.nutrition = 100;
    world.add_person(80, 50, home.id);
    const stranded = world.people.at(-1);
    stranded.role = 'soldier'; stranded.age = 25 * world.year_length;
    stranded.trait_ids = []; stranded.needs.nutrition = 100;
    home.food = 100;
    const before = { x: person.x, stranded_x: stranded.x, stranded_y: stranded.y };
    world.step(0.125);
    assert.equal(world.army_orders[0].reason, 'home_blocked');
    assert.ok(person.x < before.x, 'reachable soldier marches home');
    assert.equal(stranded.x, before.stranded_x); assert.equal(stranded.y, before.stranded_y);
    assert.equal(person.task, 'Retreating');
});
