import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_buildings } from '../src/settlements.js';
import { advance_civic } from '../src/civic.js';
import { advance_daily_life } from '../src/daily_life.js';

function town() {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    kingdom.houses.push({ x: 52, y: 50 }); kingdom.wood = 1000;
    for (let i = 0; i < 20; i++) world.add_person(50, 50, kingdom.id);
    return { world, kingdom };
}

test('hungry towns build productive essentials before civic luxuries or barracks', () => {
    const { world, kingdom } = town(); kingdom.food = 0;
    for (let i = 0; i < 4; i++) advance_buildings(world, kingdom, 12, 20, 8);
    assert.deepEqual(kingdom.buildings.map(b => b.type), ['farm', 'well', 'granary', 'clinic']);
    const rich_wood = kingdom.wood;
    kingdom.food = 0;
    advance_buildings(world, kingdom, 12, 20, 8);
    assert.equal(kingdom.wood, rich_wood);
    world.step(0.125); assert.equal(kingdom.barracks, 0);
});

test('a field needs an adult farmer and a harvest creates one conserved crop yield', () => {
    const { world, kingdom } = town();
    kingdom.buildings = [{ type: 'farm', x: 55, y: 50, growth: 0.99, harvests: 0, stock: 0 }];
    kingdom.build_timer = 0;
    for (const person of world.people) person.age = world.year_length * 10;
    const before = kingdom.food;
    advance_buildings(world, kingdom, 1, 20, 0);
    assert.equal(kingdom.food, before); assert.equal(kingdom.buildings[0].growth, 0.99);
    world.people[0].age = world.year_length * 20; world.people[0].job = 'farmer';
    world.people[0].x = 55.5; world.people[0].y = 50.5;
    world.people[0].daily_life = { phase: 'work', timer: 0, energy: 80,
        site: { kind: 'farm', x: 55, y: 50 }, cargo: { food: 0, wood: 0 } };
    advance_buildings(world, kingdom, 1, 20, 0);
    assert.equal(kingdom.food - before + kingdom.buildings[0].stock, 120);
});

test('granaries store existing food and release it during shortages without generating supplies', () => {
    const { world, kingdom } = town();
    const granary = { type: 'granary', x: 55, y: 50, stock: 0 };
    kingdom.buildings = [granary]; kingdom.food = 200;
    advance_civic(world, kingdom, world.people, 10);
    assert.equal(kingdom.food + granary.stock, 200); assert.equal(granary.stock, 20);
    kingdom.food = 0;
    advance_civic(world, kingdom, world.people, 2);
    assert.equal(kingdom.food, 8); assert.equal(granary.stock, 12);
});

test('schools teach children on site, wells suppress local fire, and sanctuaries improve rest', () => {
    const { world, kingdom } = town();
    kingdom.buildings = ['school', 'well', 'temple'].map(type => ({ type, x: 50, y: 50 }));
    const child = world.people[0]; child.age = world.year_length * 10;
    advance_daily_life(world, child, kingdom, kingdom, 0.1, 150);
    assert.equal(child.task, 'Learning at school');
    const xp = child.xp;
    const resting = world.people[1];
    resting.daily_life = { phase: 'rest', energy: 20 };
    world.fire[world.index(50, 50)] = 4;
    advance_civic(world, kingdom, world.people, 1);
    assert.ok(child.xp > xp); assert.equal(world.fire[world.index(50, 50)], 2);
    assert.equal(resting.daily_life.energy, 22);
});
