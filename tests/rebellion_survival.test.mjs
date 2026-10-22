import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_society, rebellion_cohort, rehome_person } from '../src/society.js';
import { initialize_daily_life } from '../src/daily_life.js';

function town() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'rebellion-homes' });
    world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    for (let i = 0; i < 16; i++) world.add_person(50, 50, kingdom.id);
    kingdom.age = 41;
    return { world, kingdom };
}

test('rebellions select adult households instead of the oldest citizens and repair their homes', () => {
    const { world, kingdom } = town();
    for (const p of world.people.slice(0, 6)) p.age = world.year_length * 90;
    const [a, b] = world.people.slice(6, 8);
    a.partner_id = b.id; b.partner_id = a.id;
    initialize_daily_life(a); a.daily_life.phase = 'work';
    a.work_target = { x: 40, y: 40, route: true, task: 'Gathering food' };
    const identities = new Map(world.people.map(p => [p.id, { age: p.age, name: p.name }]));
    world.laws.rebellions = true; world.tick = 160; world.random = () => 0.1;
    world.advance_history();
    const child = world.villages[1]; assert.ok(child);
    const rebels = world.people.filter(p => p.village_id === child.id);
    assert.equal(rebels.length, 4);
    assert.equal(a.village_id, child.id); assert.equal(b.village_id, child.id);
    for (const p of rebels) {
        assert.equal(p.home_id, child.id);
        assert.ok(p.age / world.year_length <= 70);
        assert.deepEqual({ age: p.age, name: p.name }, identities.get(p.id));
    }
    assert.equal(a.work_target, undefined); assert.equal(a.daily_life.phase, 'return');
    assert.equal(a.partner_id, b.id);
    assert.equal(world.people.filter(p => p.village_id === kingdom.id).length, 12);
    assert.doesNotThrow(() => World.deserialize(world.serialize()));
});

test('children, elders, sick citizens, prisoners and assigned crews cannot found a rebellion', () => {
    const { world, kingdom } = town();
    for (const p of world.people) p.age = world.year_length * 90;
    const [child, sick, prisoner, crew, recovering] = world.people;
    child.age = 17 * world.year_length;
    for (const p of [sick, prisoner, crew, recovering]) p.age = 20 * world.year_length;
    sick.health = 30; prisoner.prisoner_of = kingdom.id; recovering.recovering = true;
    world.machines = [{ crew_id: crew.id }];
    assert.deepEqual(rebellion_cohort(world, kingdom.id), []);
});

test('old foreign homes are repaired on a copy; nonexistent homes still fail validation', () => {
    const { world } = town();
    const other = world.found_village(65, 50);
    const person = world.people[0]; person.village_id = other.id;
    initialize_daily_life(person); person.daily_life.phase = 'work';
    const saved = world.serialize(), original = structuredClone(saved);
    const restored = World.deserialize(saved), migrant = restored.people[0];
    assert.deepEqual(saved, original);
    assert.equal(migrant.home_id, other.id); assert.equal(migrant.daily_life.phase, 'return');
    assert.equal(restored.people.length, saved.people.length);
    assert.equal(migrant.age, person.age); assert.equal(migrant.health, person.health);
    assert.doesNotThrow(() => World.deserialize(restored.serialize()));
    const bad = structuredClone(saved); bad.people[0].home_id = bad.next_id + 100;
    assert.throws(() => World.deserialize(bad));
});

test('moving a citizen releases cross-town partnerships without removing family memories', () => {
    const { world, kingdom } = town();
    const other = world.found_village(65, 50), [a, b] = world.people;
    a.partner_id = b.id; b.partner_id = a.id;
    a.relationships = [{ id: b.id, name: b.name, affinity: 30 }];
    kingdom.social_year = world.year; other.social_year = world.year;
    rehome_person(world, a, other.id, other.id);
    advance_society(world);
    assert.equal(a.partner_id, null);
    assert.notEqual(b.partner_id, a.id);
    if (b.partner_id) {
        const partner = world.people.find(p => p.id === b.partner_id);
        assert.equal(partner.village_id, b.village_id);
        assert.equal(partner.home_id, b.home_id);
    }
    assert.equal(a.relationships[0].id, b.id);
});
