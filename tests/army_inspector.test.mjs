import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { army_members, army_summary, army_visible, army_badge_hit, army_target,
    rebuild_armies, siege_markers, siege_badge_layout } from '../src/army_inspector.js';

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

test('target siege summary is primary target data and does not attribute rival pressure to this army', () => {
    const { world, home, enemy, selection } = fixture();
    const rival = world.found_village(160, 90);
    world.set_relation(rival.id, enemy.id, 'war');
    for (let index = 0; index < 4; index++) {
        world.add_person(enemy.x + index * 0.3, enemy.y, rival.id);
        world.people.at(-1).role = 'soldier';
    }
    enemy.siege = 12; enemy.siege_attacker_id = rival.id;
    const before = world.serialize();
    const summary = army_summary(world, selection);
    assert.equal(summary.siege.kind, 'capital');
    assert.equal(summary.siege.attacker_id, rival.id);
    assert.equal(summary.siege.attacker_name, rival.name);
    assert.notEqual(summary.siege.attacker_id, home.id);
    assert.equal(summary.siege.attackers, 4);
    assert.ok(summary.siege.required > 14, 'Display the mechanics threshold, not the former hard-coded value');
    assert.deepEqual(world.serialize(), before);
});

test('siege marker eligibility validates pressure, current attacks and selected targets without mutations', () => {
    const { world, home, enemy, selection } = fixture();
    const selected = { home_id: home.id, kingdom_id: home.id };
    const quiet = world.found_village(70, 90);
    assert.deepEqual(siege_markers(world, null), []);
    let markers = siege_markers(world, selected);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].site.id, enemy.id);
    assert.equal(markers[0].siege.percent, 0);
    assert.ok(!markers.some(marker => marker.site.id === quiet.id));
    enemy.siege = 12; enemy.siege_attacker_id = home.id;
    for (const person of world.people) { person.x = enemy.x - 2; person.y = enemy.y; }
    const before = world.serialize();
    markers = siege_markers(world, null);
    assert.equal(markers.length, 1);
    assert.ok(markers[0].siege.percent > 0);
    assert.deepEqual(world.serialize(), before);
    world.set_relation(home.id, enemy.id, 'peace');
    const paused = world.serialize();
    assert.equal(army_summary(world, selection).siege, null);
    assert.deepEqual(siege_markers(world, selected), []);
    assert.deepEqual(world.serialize(), paused, 'Ended pressure is hidden while saved paused state stays exact');
});

test('siege badge dimensions remain fixed at every zoom and avoid occupied labels/window edges', () => {
    const marker = { site: { x: 50, y: 50 } };
    for (const scale of [0.4, 1, 4, 24]) {
        const camera = { origin: { x: 400 - 300 * scale, y: 300 - 300 * scale },
            scale, width: 1024, height: 650 };
        const box = siege_badge_layout(marker, camera);
        assert.equal(box.width, 100); assert.equal(box.height, 28);
        assert.ok(box.x >= 8 && box.x + box.width <= camera.width - 8);
        assert.ok(box.y >= 70 && box.y + box.height <= camera.height - 70);
        const shifted = siege_badge_layout(marker, camera, [box]);
        assert.notDeepEqual(shifted, box);
        assert.equal(siege_badge_layout(marker, camera,
            [{ x: 0, y: 0, width: 1024, height: 650 }]), null);
    }
});
