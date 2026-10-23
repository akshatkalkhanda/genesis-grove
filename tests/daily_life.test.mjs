import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, WIDTH, HEIGHT } from '../src/simulation.js';
import { initialize_daily_life, advance_daily_life, collect_daily_goods, valid_daily_life } from '../src/daily_life.js';

function setup() {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS); world.fertility.fill(1);
    const home = world.found_village(40, 50); world.add_person(40, 50, home.id);
    const person = world.people[0]; person.age = world.year_length * 20; person.job = 'farmer';
    home.houses = [{ x: 40, y: 50 }];
    return { world, home, person, state: initialize_daily_life(person) };
}

test('farm goods are removed from finite stock and credited only after a return trip', () => {
    const { world, home, person, state } = setup();
    const farm = { type: 'farm', x: 45, y: 50, stock: 3 };
    home.buildings = [farm]; person.x = 45;
    state.phase = 'work'; state.site = { x: 45, y: 50, kind: 'farm' };
    const before = home.food;
    const credited = collect_daily_goods(world, person, home, 3, 2);
    assert.ok(Math.abs(credited.food - 1.8) < 1e-9); assert.equal(credited.wood, 0);
    assert.equal(farm.stock, 0); assert.equal(state.cargo.food, 3); assert.equal(home.food, before);
    collect_daily_goods(world, person, home, 3, 2);
    assert.equal(state.cargo.food, 3);
    state.phase = 'return'; person.x = 40;
    advance_daily_life(world, person, home, home, 0.1, 150);
    assert.equal(home.food, before + 3); assert.equal(state.cargo.food, 0);
    advance_daily_life(world, person, home, home, 0.1, 150);
    assert.equal(home.food, before + 3);
});

test('finite forest harvest fills cargo without duplicate treasury credit', () => {
    const { world, home, person, state } = setup();
    person.job = 'lumberjack'; world.tiles[world.index(40, 50)] = T.FOREST;
    world.fertility[world.index(40, 50)] = 0.1;
    state.phase = 'work'; state.site = { x: 40, y: 50, kind: 'forest' };
    const before = home.wood;
    collect_daily_goods(world, person, home, 3, 10);
    assert.ok(state.cargo.wood > 1.9 && state.cargo.wood < 2.1);
    assert.equal(home.wood, before); assert.equal(world.fertility[world.index(40, 50)], 0);
    const carried = state.cargo.wood;
    collect_daily_goods(world, person, home, 3, 10);
    assert.equal(state.cargo.wood, carried);
});

test('rest recovers energy and health at home and children do not operate industrial jobs', () => {
    const { world, home, person, state } = setup();
    state.phase = 'rest'; state.energy = 20; person.health = 50; home.food = 20;
    const action = advance_daily_life(world, person, home, home, 2, 100);
    assert.equal(action.holding, true); assert.equal(state.energy, 32); assert.equal(person.health, 51.2);
    person.age = world.year_length * 10; person.job = 'smith'; state.phase = 'travel'; state.site = null;
    advance_daily_life(world, person, home, home, 0.1, 100);
    assert.equal(state.site.kind, 'home'); assert.equal(person.task, 'Learning and playing');
    const subsistence = collect_daily_goods(world, person, home, 3, 2);
    assert.equal(subsistence.food, 0); assert.equal(subsistence.wood, 0);
});

test('unsafe sites and blocked deliveries cannot remotely deposit cargo', () => {
    const { world, home, person, state } = setup();
    state.site = { x: 45, y: 50, kind: 'forage' }; state.phase = 'work'; person.x = 45;
    state.cargo.food = 3; world.fire[world.index(45, 50)] = 1;
    const before = home.food;
    const action = advance_daily_life(world, person, home, home, 0.1, 100);
    assert.equal(state.phase, 'return'); assert.equal(action.target.x, 40);
    state.timer = 60;
    advance_daily_life(world, person, home, home, 0.1, 100);
    assert.equal(state.phase, 'rest'); assert.equal(state.cargo.food, 0); assert.equal(home.food, before);
});

test('routine validation accepts legacy absence and rejects forged cargo and destinations', () => {
    const { state } = setup();
    assert.equal(valid_daily_life(undefined, WIDTH, HEIGHT), true);
    assert.equal(valid_daily_life(state, WIDTH, HEIGHT), true);
    state.cargo.food = Infinity; assert.equal(valid_daily_life(state, WIDTH, HEIGHT), false);
    state.cargo.food = 0; state.site = { x: -1, y: 20, kind: 'farm' };
    assert.equal(valid_daily_life(state, WIDTH, HEIGHT), false);
});
