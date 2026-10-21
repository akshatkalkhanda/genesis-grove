import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { army_members, army_summary, army_visible, army_badge_hit, army_target, rebuild_armies } from '../src/army_inspector.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'army-inspection' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(35, 55), enemy = world.found_village(135, 55);
    for (let index = 0; index < 8; index++) {
        world.add_person(35 + index, 55, home.id);
        const person = world.people.at(-1); person.role = 'soldier'; person.task = 'Guarding';
    }
    world.set_relation(home.id, enemy.id, 'war');
    const plan = () => world.plan_armies(new Map([[home.id, new Set([enemy.id])]]));
    plan();
    return { world, home, enemy, plan, selection: { id: home.id, kingdom_id: home.id } };
}

test('inspection matches active garrison membership without counting recovering or absent soldiers', () => {
    const { world, home, plan, selection } = fixture();
    world.people[1].health = 0;
    world.people[2].recovering = true;
    world.people[3].voyage_id = 99;
    world.people[4].prisoner_of = 99;
    world.machines.push({ crew_id: world.people[5].id });
    world.people[6].role = 'civilian';
    plan();
    const summary = army_summary(world, selection);
    assert.equal(world.armies[0].count, 2);
    assert.equal(summary.members.length, 2);
    assert.equal(summary.strength, summary.members.reduce((sum, person) => sum
        + creature_stats(person, world.year_length).strength, 0));
    assert.ok(summary.members.every(person => person.village_id === home.id));
    assert.deepEqual(army_members(world, summary.army), summary.members);
});

test('equipment and activity reflect current members while target pressure remains settlement data', () => {
    const { world, enemy, selection } = fixture();
    world.people[0].weapon_level = 3; world.people[0].armor_level = 2;
    world.people[0].task = 'Retreating'; enemy.siege = 5;
    const before = world.serialize();
    const summary = army_summary(world, selection);
    assert.equal(summary.target.id, enemy.id);
    assert.equal(summary.target.siege, 5);
    assert.deepEqual(summary.activity, [['Guarding', 7], ['Retreating', 1]]);
    assert.deepEqual(summary.weapons, [[0, 7], [3, 1]]);
    assert.deepEqual(summary.armor, [[0, 7], [2, 1]]);
    assert.deepEqual(world.serialize(), before, 'Inspecting must not mutate a save');
});

test('peace, target capture, kingdom death and garrison loss invalidate stale selection safely', () => {
    const { world, home, enemy, selection } = fixture();
    world.set_relation(home.id, enemy.id, 'peace');
    assert.equal(army_summary(world, selection).target, undefined);
    assert.equal(army_target(world, world.armies[0]), undefined);
    world.set_relation(home.id, enemy.id, 'war'); enemy.alive = false;
    assert.equal(army_summary(world, selection).target, undefined);
    home.alive = false;
    assert.equal(army_summary(world, selection), null);
    home.alive = true;
    for (const person of world.people) person.health = 0;
    assert.equal(army_summary(world, selection), null);
});

test('badge hit area stays in screen pixels and only displayed garrisons can be selected', () => {
    const army = { count: 4, x: 10, y: 20, kingdom_id: 1, home_id: 2, target_id: null };
    assert.equal(Boolean(army_visible(army, 'political', null, null)), false);
    assert.ok(army_visible(army, 'armies', null, null));
    assert.ok(army_visible({ ...army, state: 'retreat' }, 'political', null, null));
    assert.ok(army_visible(army, 'political', null, { home_id: 2, kingdom_id: 1 }));
    for (const scale of [0.4, 1, 10]) {
        const origin = { x: 7, y: 13 }, x = 7 + 60 * scale, y = 13 + 120 * scale;
        assert.equal(army_badge_hit(army, { x, y: y - 18 }, origin, scale), true);
        assert.equal(army_badge_hit(army, { x, y: y + 1 }, origin, scale), false);
        assert.equal(army_badge_hit(army, { x: x + 25, y: y - 18 }, origin, scale), false);
    }
});

test('saved orders rebuild garrisons without persisting inspector selection', () => {
    const { world, home, selection } = fixture();
    const save = world.serialize();
    assert.equal(Object.hasOwn(save, 'armies'), false);
    assert.equal(save.army_orders[0].target_id, world.armies[0].target_id);
    const restored = World.deserialize(save);
    const restored_save = restored.serialize();
    rebuild_armies(restored);
    assert.deepEqual(restored.serialize(), restored_save, 'Rebuilding paused markers does not advance time');
    const summary = army_summary(restored, selection);
    assert.equal(summary.kingdom.id, home.id);
    assert.equal(summary.members.length, 8);
    assert.ok(summary.target);
    assert.deepEqual(restored.serialize().people.map(person => person.id), save.people.map(person => person.id));
});
