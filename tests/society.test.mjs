import test from 'node:test';
import assert from 'node:assert/strict';
import { initialize_society_person, advance_society, select_parents, initialize_child,
    socialize, society_modifiers, validate_society_person, validate_culture } from '../src/society.js';
import { creature_stats } from '../src/creatures.js';

function fixture() {
    const kingdom = { id: 1, alive: true };
    const people = [2, 3, 4].map(id => initialize_society_person({ id, name: `Citizen ${id}`,
        village_id: 1, home_id: 1, x: 10, y: 10, age: 400, health: 100 }, kingdom));
    return { villages: [kingdom], people, year: 1, year_length: 20 };
}

test('nearby adult friends form reciprocal partnerships, with bounded persistent contacts', () => {
    const world = fixture();
    advance_society(world);
    world.year++;
    advance_society(world);
    const parents = select_parents(world, 1, 1);
    assert.equal(parents.length, 2);
    assert.equal(parents[0].partner_id, parents[1].id);
    assert.equal(parents[1].partner_id, parents[0].id);
    for (let id = 10; id < 40; id++) {
        socialize(parents[0], { id, name: `Friend ${id}`, health: 100 });
    }
    assert.equal(parents[0].relationships.length, 8);
    assert.ok(parents[0].relationships.some(r => r.id === parents[1].id));
    assert.ok(validate_society_person(parents[0], 100));
    assert.deepEqual(JSON.parse(JSON.stringify(parents[0])).relationships, parents[0].relationships);
});

test('children inherit family, culture and traits, retain parent records after death', () => {
    const world = fixture();
    const parents = world.people.slice(0, 2);
    parents[0].trait = 'curious';
    parents[1].trait = 'hardy';
    const child = initialize_child({ id: 5, age: 0, health: 100, village_id: 1 }, parents,
        world.villages[0], () => 0, world.year);
    assert.equal(child.trait, 'curious');
    assert.equal(child.heritage_trait, 'hardy');
    assert.equal(child.family_id, parents[0].family_id);
    assert.equal(child.culture_id, 1);
    assert.equal(creature_stats(child).max_health, 104);
    const snapshots = structuredClone(child.parents);
    world.people = [child];
    world.year++;
    advance_society(world);
    assert.deepEqual(child.parents, snapshots);
    assert.equal(parents[0].children_count, 1);
    assert.equal(parents[0].last_child_year, 1);
    assert.ok(validate_society_person(child, 10));
});

test('birth selection excludes children, close relatives, prisoners and recent parents', () => {
    const world = fixture();
    const [a, b] = world.people;
    a.partner_id = b.id; b.partner_id = a.id;
    assert.ok(select_parents(world, 1, 1));
    a.age = 17 * 20;
    assert.equal(select_parents(world, 1, 1), null);
    a.age = 400;
    a.parents = [{ id: 99, name: 'Parent' }];
    b.parents = [{ id: 99, name: 'Parent' }];
    assert.equal(select_parents(world, 1, 1), null);
    b.parents = [];
    a.prisoner_of = 10;
    assert.equal(select_parents(world, 1, 1), null);
    delete a.prisoner_of;
    a.last_child_year = world.year;
    assert.equal(select_parents(world, 1, 1), null);
    world.year += 2;
    assert.ok(select_parents(world, 1, 1));
});

test('lost partners become available again while identity and memories survive', () => {
    const world = fixture();
    const [a, b] = world.people;
    a.partner_id = b.id; b.partner_id = a.id;
    socialize(a, b);
    world.people = [a];
    advance_society(world);
    assert.equal(a.partner_id, null);
    assert.equal(a.relationships[0].name, b.name);
    assert.equal(a.family_id, a.id);
});

test('distant descendants can form families within the same founding clan', () => {
    const world = fixture(), [a, b] = world.people;
    world.people = [a, b];
    a.family_id = b.family_id = 99;
    a.parents = [{ id: 90, name: 'Earlier generation A' }];
    b.parents = [{ id: 91, name: 'Earlier generation B' }];
    advance_society(world); world.year++; advance_society(world);
    assert.deepEqual(select_parents(world, 1, 1).map(p => p.id), [a.id, b.id]);
    assert.equal(a.family_id, 99); assert.equal(b.family_id, 99);
});

test('parent, grandparent, sibling and known first-cousin links still block births', () => {
    for (const relation of ['parent', 'grandparent', 'sibling', 'cousin']) {
        const world = fixture(), [a, b] = world.people;
        a.partner_id = b.id; b.partner_id = a.id;
        const parent = { id: 90, parents: [{ id: b.id, name: b.name }], health: 0 };
        if (relation === 'parent') a.parents = [{ id: b.id, name: b.name }];
        if (relation === 'grandparent') {
            a.parents = [{ id: parent.id, name: 'Parent' }]; world.people.push(parent);
        }
        if (relation === 'sibling') {
            a.parents = b.parents = [{ id: 90, name: 'Shared parent' }];
        }
        if (relation === 'cousin') {
            parent.parents = [{ id: 99, name: 'Shared grandparent' }];
            a.parents = [{ id: 90, name: 'Parent A' }];
            b.parents = [{ id: 91, name: 'Parent B' }];
            world.people.push(parent, { id: 91, parents: parent.parents, health: 0 });
        }
        assert.equal(select_parents(world, 1, 1), null, relation);
    }
});

test('culture and ruler personality change research, production and war policy', () => {
    const kingdom = { id: 1, culture: { name: 'Readers', value: 'knowledge' } };
    assert.ok(society_modifiers(kingdom, { trait: 'curious' }).research > 1.3);
    kingdom.culture.value = 'craft';
    assert.ok(society_modifiers(kingdom, { trait: 'industrious' }).production > 1.2);
    kingdom.culture.value = 'kinship';
    assert.equal(society_modifiers(kingdom, { trait: 'careful' }).war_bias, -0.25);
    assert.equal(society_modifiers(kingdom, { trait: 'hardy' }).healing, 1.2);
    kingdom.culture.value = 'valor';
    assert.equal(society_modifiers(kingdom, { trait: 'brave' }).war_bias, 0.26);
});

test('legacy society is optional, malformed and oversized relation data are rejected', () => {
    assert.ok(validate_society_person({ id: 2 }, 10));
    assert.ok(validate_culture({ id: 1 }));
    assert.equal(validate_culture({ culture: { name: 'Bad', value: 'invalid' } }), false);
    assert.equal(validate_society_person({ id: 2, partner_id: 2 }, 10), false);
    assert.equal(validate_society_person({ id: 2, heritage_trait: 'invalid' }, 10), false);
    const relation = { id: 3, name: 'Friend', affinity: 10 };
    assert.equal(validate_society_person({ id: 2, relationships: [relation, relation] }, 10), false);
    assert.equal(validate_society_person({ id: 2, relationships: [{ ...relation, affinity: NaN }] }, 10), false);
    assert.equal(validate_society_person({ id: 2, relationships: Array(9).fill(relation) }, 10), false);
});
