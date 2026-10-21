import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { creature_stats } from '../src/creatures.js';
import { army_identity } from '../src/army_orders.js';
import { army_summary, rebuild_armies } from '../src/army_inspector.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'persistent-orders' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(35, 55), enemy = world.found_village(100, 55);
    home.food = 1000; enemy.food = 1000;
    for (const x of [35, 35.3]) {
        world.add_person(x, 55, home.id); world.people.at(-1).role = 'soldier';
    }
    world.add_person(100, 55, enemy.id);
    world.set_relation(home.id, enemy.id, 'war');
    const members = world.people.slice(0, 2);
    const plan = () => {
        const wars = new Map();
        for (const relation of world.relations.filter(relation => relation.status === 'war')) {
            for (const [a, b] of [[relation.a, relation.b], [relation.b, relation.a]]) {
                if (!wars.has(a)) wars.set(a, new Set());
                wars.get(a).add(b);
            }
        }
        world.plan_armies(wars);
        return world.army_orders.find(order => order.kingdom_id === home.id);
    };
    const selection = { id: home.id, kingdom_id: home.id };
    return { world, home, enemy, members, plan, selection };
}

const health_ratio = (world, people, fraction) => {
    for (const person of people) person.health = creature_stats(person, world.year_length).max_health * fraction;
};

test('stable home identity and target survive nearer alternatives and paused reconstruction', () => {
    const { world, home, enemy, members, plan, selection } = fixture();
    const original = plan();
    assert.equal(original.id, army_identity(home.id, home.id));
    assert.equal(original.state, 'march');
    const closer = world.found_village(50, 55); world.add_person(50, 55, closer.id);
    world.set_relation(home.id, closer.id, 'war');
    members[0].x = 42; members[1].x = 42.3;
    assert.deepEqual(plan(), original, 'a closer rival cannot replace an ongoing campaign');
    assert.equal(plan().target_id, enemy.id);
    const restored = World.deserialize(world.serialize()), before = restored.serialize();
    rebuild_armies(restored);
    assert.deepEqual(restored.serialize(), before);
    assert.equal(army_summary(restored, selection).army.id, original.id);
    assert.equal(army_summary(restored, selection).target.id, enemy.id);
});

test('assemble, march and attack correspond to regrouping and approaching siege range', () => {
    const { world, members, enemy, plan } = fixture();
    members[1].x = 49;
    assert.equal(plan().state, 'assemble');
    const before = members[1].x;
    world.step(0.125);
    assert.ok(members[1].x < before, 'assembly actually sends the dispersed soldier home');
    assert.equal(members[1].task, 'Assembling');
    members[1].x = 36;
    assert.equal(plan().state, 'march');
    for (const person of members) person.x = enemy.x - 5;
    assert.equal(plan().state, 'attack');
    assert.equal(plan().reason, 'attack');
});

test('local home attackers override a campaign and defenders move home', () => {
    const { world, home, enemy, members, plan } = fixture();
    plan(); members.forEach(person => { person.x = 60; });
    world.add_person(home.x + 3, home.y, enemy.id); world.people.at(-1).role = 'soldier';
    const order = plan();
    assert.equal(order.state, 'defend'); assert.equal(order.reason, 'home_threat');
    world.step(0.125);
    assert.ok(members.every(person => person.x < 60));
});

test('wounded and food-poor campaigns retreat with recovery hysteresis and hold at home', () => {
    const { world, home, members, plan } = fixture();
    plan(); members.forEach(person => { person.x = 60; });
    health_ratio(world, members, 0.4);
    assert.equal(plan().state, 'retreat'); assert.equal(plan().reason, 'low_health');
    health_ratio(world, members, 0.6);
    assert.equal(plan().reason, 'low_health');
    health_ratio(world, members, 0.8);
    assert.equal(plan().state, 'march');
    home.food = 5;
    assert.equal(plan().reason, 'low_food');
    world.step(0.125);
    assert.ok(members.every(person => person.x < 60 && person.task === 'Retreating'));
    home.food = 12;
    assert.equal(plan().reason, 'low_food', 'food recovery needs reserve above entry threshold');
    members.forEach(person => { person.x = home.x; });
    assert.equal(plan().state, 'defend');
    const before = members.map(person => ({ x: person.x, y: person.y }));
    world.step(0.125);
    assert.deepEqual(members.map(person => ({ x: person.x, y: person.y })), before, 'food hold actually holds');
    home.food = 30;
    assert.equal(plan().state, 'march');
});

test('actual health and equipped enemy strength gate a campaign', () => {
    const { world, enemy, members, plan } = fixture();
    for (let index = 0; index < 3; index++) {
        world.add_person(enemy.x, enemy.y, enemy.id);
        const defender = world.people.at(-1); defender.role = 'soldier'; defender.weapon_level = 4;
    }
    assert.equal(plan().reason, 'stronger_enemy');
    members.forEach(person => { person.weapon_level = 8; person.armor_level = 5; });
    assert.equal(plan().state, 'march', 'real equipped gear changes readiness');
});

test('equipped-strength hysteresis keeps an existing campaign through a marginal defense change', () => {
    const { world, enemy, members, plan } = fixture();
    const original = plan();
    for (const member of members) world.people.push({ ...structuredClone(member), id: world.next_id++,
        village_id: enemy.id, home_id: enemy.id, x: enemy.x, y: enemy.y });
    assert.deepEqual(plan(), original, 'equal equipped strength does not cancel an ongoing campaign');
    world.army_orders = [];
    assert.equal(plan().reason, 'stronger_enemy', 'the same marginal matchup cannot start a fresh campaign');
});

test('peace, ownership, death, dispersed membership and kingdom changes invalidate safely', () => {
    const { world, home, enemy, members, plan, selection } = fixture();
    plan(); const original = world.serialize();
    world.set_relation(home.id, enemy.id, 'peace');
    const paused = world.serialize(); rebuild_armies(world);
    assert.deepEqual(world.serialize(), paused);
    assert.match(army_summary(world, selection).order_label, /awaiting review/);
    assert.equal(plan().reason, 'peace');
    world.set_relation(home.id, enemy.id, 'war'); plan(); enemy.alive = false;
    assert.equal(plan().reason, 'target_changed');
    const other = World.deserialize(original);
    assert.equal(other.conquer_site(other.villages[1], home.id), true);
    other.plan_armies(new Map([[home.id, new Set([enemy.id])]]));
    assert.equal(other.army_orders[0].reason, 'target_changed');
    members.forEach(person => { person.recovering = true; });
    assert.equal(plan(), undefined); assert.equal(army_summary(world, selection), null);
    members.forEach(person => { person.recovering = false; person.village_id = enemy.id; person.home_id = enemy.id; });
    plan(); assert.ok(world.army_orders.every(order => order.id !== army_identity(home.id, home.id)));
});

test('terrain blockage stops a campaign, rejects unreachable towns and never takes a direct fallback', () => {
    const { world, members, plan } = fixture();
    assert.equal(plan().state, 'march');
    for (let y = 0; y < 128; y++) world.set_tile(70, y, T.MOUNTAIN);
    assert.equal(plan().reason, 'route_blocked');
    assert.equal(plan().reason, 'unreachable');
    const before = { x: members[0].x, y: members[0].y };
    world.march(members[0], { x: 100, y: 55, route: true, army: true }, 0.125, 1.55);
    assert.deepEqual({ x: members[0].x, y: members[0].y }, before);
    // A member stranded away from home has an explicit hold order, not an impossible march.
    members[1].x = 90;
    assert.equal(plan().reason, 'home_blocked');
    const isolated = { x: members[1].x, y: members[1].y };
    world.step(0.125);
    assert.deepEqual({ x: members[1].x, y: members[1].y }, isolated);
});

test('mid-march save resume stays deterministic with saved orders and transient route caches', () => {
    const { world } = fixture();
    for (let index = 0; index < 80; index++) world.step(0.125);
    assert.equal(world.army_orders[0].state, 'march');
    const resumed = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    const before = resumed.serialize(); rebuild_armies(resumed);
    assert.deepEqual(resumed.serialize(), before);
    for (let index = 0; index < 60; index++) { world.step(0.125); resumed.step(0.125); }
    assert.deepEqual(resumed.serialize(), world.serialize());
    // Road construction increments navigation_revision, just like advance_roads.
    for (let x = 45; x < 100; x++) world.roads[world.index(x, 56)] = 2;
    world.navigation_revision++;
    world.step(0.125);
    const roads_resumed = World.deserialize(world.serialize()); rebuild_armies(roads_resumed);
    for (let index = 0; index < 40; index++) { world.step(0.125); roads_resumed.step(0.125); }
    assert.deepEqual(roads_resumed.serialize(), world.serialize());
});

test('legacy cold load and repeated paused inspection cannot issue or overwrite orders', () => {
    const { world, selection } = fixture();
    const legacy = world.serialize(); delete legacy.army_orders;
    const loaded = World.deserialize(legacy), before = loaded.serialize();
    for (let index = 0; index < 3; index++) rebuild_armies(loaded);
    assert.deepEqual(loaded.serialize(), before);
    assert.equal(loaded.army_orders.length, 0);
    assert.equal(army_summary(loaded, selection).army.reason, 'awaiting_plan');
    loaded.step(0.125);
    assert.equal(loaded.army_orders[0].state, 'march');
});

test('malformed, duplicate, inconsistent and unbounded imported orders are rejected atomically', () => {
    const { world, enemy, plan } = fixture(); plan();
    const good = world.serialize();
    const mutations = [
        data => { data.army_orders = null; },
        data => { data.army_orders = Array(361).fill(data.army_orders[0]); },
        data => { data.army_orders.push({ ...data.army_orders[0] }); },
        data => { data.army_orders[0].id = 'forged'; },
        data => { data.army_orders[0].kingdom_id = enemy.id; },
        data => { data.army_orders[0].home_id = 999999; },
        data => { data.army_orders[0].state = 'teleport'; },
        data => { data.army_orders[0].reason = 'arbitrary'; },
        data => { data.army_orders[0].reason = 'peace'; },
        data => { data.army_orders[0].issued_tick = data.tick + 1; },
        data => { data.army_orders[0].target_id = data.people[0].id; },
        data => { data.army_orders[0].target_id = null; },
        data => { data.army_orders[0].extra = 'unbounded payload'; }
    ];
    for (const mutate of mutations) {
        const corrupt = structuredClone(good); mutate(corrupt);
        assert.throws(() => World.deserialize(corrupt), /valid Genesis/);
    }
    assert.deepEqual(world.serialize(), good);
    assert.deepEqual(World.deserialize(good).army_orders, world.army_orders);
});
