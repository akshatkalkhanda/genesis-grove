import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { choose_ruler, royal_successors } from '../src/heraldry.js';

function court(scenario = 'sandbox') {
    const world = new World({ preset: 'empty', inhabited: false, scenario, seed: 'royal-line' });
    world.tiles.fill(T.GRASS);
    for (let i = 0; i < 5; i++) world.add_person(50 + i, 50);
    return { world, kingdom: world.villages[0], people: world.people };
}

test('eldest eligible adult child inherits ahead of an experienced unrelated adult', () => {
    const { world, kingdom, people } = court();
    const [king, younger, elder, veteran, minor] = people;
    younger.parents = [{ id: king.id, name: king.name }]; younger.age = 21 * world.year_length;
    elder.parents = [{ id: king.id, name: king.name }]; elder.age = 26 * world.year_length;
    minor.parents = [{ id: king.id, name: king.name }]; minor.age = 17 * world.year_length;
    veteran.xp = 100000;
    const before = JSON.stringify(world.serialize());
    assert.equal(royal_successors(kingdom, people, world.year_length)[0].id, elder.id);
    assert.equal(choose_ruler(kingdom, people, world.year_length), king);
    assert.equal(JSON.stringify(world.serialize()), before, 'Reading the heir does not mutate the world');
    world.time = 50 * world.year_length;
    king.health = 0; world.clean_up();
    assert.equal(kingdom.king_id, elder.id);
    assert.equal(kingdom.king_since_year, 51);
    assert.ok(world.events.some(e => e.text.includes('crowned King by inheritance')));
    const restored = World.deserialize(world.serialize());
    assert.equal(restored.villages[0].king_id, elder.id);
    assert.equal(restored.villages[0].king_since_year, 51);
});

test('dead, captured, travelling and minor claimants yield to a resident adult', () => {
    const { world, kingdom, people } = court();
    const [king, dead, captive, traveller, adult] = people;
    for (const person of people.slice(1)) person.parents = [{ id: king.id, name: king.name }];
    dead.health = 0; captive.prisoner_of = 500; traveller.voyage_id = 600;
    assert.deepEqual(royal_successors(kingdom, people, world.year_length).map(p => p.id), [adult.id]);
    king.health = 0;
    assert.equal(choose_ruler(kingdom, people, world.year_length), adult);
    adult.age = 17 * world.year_length;
    assert.equal(choose_ruler(kingdom, people, world.year_length), null);
});

test('living king retains crown while travelling and succession uses merit without adult children', () => {
    const { world, kingdom, people } = court();
    const [king, veteran] = people;
    king.voyage_id = 600; veteran.xp = 5000;
    assert.equal(choose_ruler(kingdom, people, world.year_length), king);
    king.health = 0; king.voyage_id = null; world.clean_up();
    assert.equal(kingdom.king_id, veteran.id);
    assert.ok(world.events.some(e => e.text.includes('crowned King by merit')));
});

test('newborn cannot take a vacant crown; adulthood uses each world calendar', () => {
    for (const scenario of ['sandbox', 'hundred']) {
        const { world, kingdom, people } = court(scenario);
        for (const person of people) person.age = 10 * world.year_length;
        world.clean_up(); assert.equal(kingdom.king_id, null);
        world.add_person(56, 50, kingdom.id, 'human', true);
        assert.equal(world.people.at(-1).age, 0);
        assert.equal(kingdom.king_id, null);
        people[1].age = 18 * world.year_length;
        world.clean_up(); assert.equal(kingdom.king_id, people[1].id);
    }
});

test('legacy reign stays unknown and invalid or future reign records are rejected', () => {
    const { world, kingdom } = court();
    const legacy = world.serialize(); delete legacy.villages[0].king_since_year;
    const restored = World.deserialize(legacy);
    assert.equal(restored.villages[0].king_id, kingdom.king_id);
    assert.equal(restored.villages[0].king_since_year, null);
    for (const value of [-1, 0, 1.5, 2, '1']) {
        const invalid = world.serialize(); invalid.villages[0].king_since_year = value;
        assert.throws(() => World.deserialize(invalid));
    }
});
