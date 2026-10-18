import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, WIDTH, HEIGHT } from '../src/simulation.js';
const blank = () => new World({ preset: 'empty', inhabited: false });
test('same seed gives identical terrain, settlements and deterministic evolution', () => {
    const a = new World({ seed: 'known world' }), b = new World({ seed: 'known world' });
    assert.deepEqual(a.serialize(), b.serialize());
    for (let i = 0; i < 120; i++) { a.step(0.125); b.step(0.125); }
    assert.deepEqual(a.serialize(), b.serialize());
    assert.notDeepEqual(a.tiles, new World({ seed: 'different world' }).tiles);
});
test('default world has viable civilizations that build and grow without intervention', () => {
    const w = new World();
    const initial = w.stats();
    assert.equal(initial.villages, 3);
    assert.ok(initial.population > 0);
    assert.ok(initial.land > 20 && initial.land < 80);
    for (let i = 0; i < 2400; i++) w.step(0.125);
    assert.ok(w.people.length > initial.population);
    assert.ok(w.villages.every(v => v.houses.length > 1));
    assert.ok(w.people.every(p => w.walkable(p.x, p.y)));
    assert.equal(w.year, 16);
});
test('terrain tools honor bounds, circular brush and walkability', () => {
    const w = blank();
    w.apply('grass', 0, 0, 2);
    assert.equal(w.tile(0, 0), T.GRASS);
    assert.equal(w.tile(2, 2), T.OCEAN);
    assert.equal(w.tiles.length, WIDTH * HEIGHT);
    w.apply('mountain', 0, 0, 1);
    assert.equal(w.walkable(0, 0), false);
    w.apply('grass', -100, -100, 12);
    assert.equal(w.tiles.length, WIDTH * HEIGHT);
});
test('life requires land; flooding removes inhabitants and retires their village', () => {
    const w = blank();
    w.apply('human', 20, 20, 4);
    assert.equal(w.people.length, 0);
    w.apply('grass', 20, 20, 10);
    w.apply('human', 20, 20, 4);
    assert.equal(w.people.length, 3);
    assert.equal(w.stats().villages, 1);
    w.apply('ocean', 20, 20, 12);
    assert.equal(w.people.length, 0);
    assert.equal(w.stats().villages, 0);
});
test('rain quenches fire and restores burned land; meteor damages units and terrain', () => {
    const w = blank();
    w.apply('forest', 30, 30, 10);
    w.apply('fire', 30, 30, 3);
    assert.ok(w.fire[w.index(30, 30)] > 0);
    w.apply('rain', 30, 30, 4);
    assert.equal(w.fire[w.index(30, 30)], 0);
    w.apply('human', 30, 30, 1);
    w.apply('meteor', 30, 30, 4);
    assert.equal(w.people.length, 0);
    assert.equal(w.tile(30, 30), T.LAVA);
    w.apply('rain', 30, 30, 5);
    assert.equal(w.tile(30, 30), T.ASH);
    w.apply('rain', 30, 30, 5);
    assert.equal(w.tile(30, 30), T.GRASS);
});
test('fire spreads to vegetation and burns out', () => {
    const w = blank();
    w.apply('forest', 40, 40, 10);
    w.apply('fire', 40, 40, 2);
    for (let i = 0; i < 2500; i++) w.step(0.125);
    assert.ok(w.tiles.some(t => t === T.ASH));
    assert.ok(w.fire.every(f => f <= 0));
});
test('blessing heals and eraser removes life without changing terrain', () => {
    const w = blank(); w.apply('grass', 40, 40, 10); w.apply('human', 40, 40, 1);
    w.people[0].health = 20; w.apply('bless', 40, 40, 5);
    assert.equal(w.people[0].health, 100);
    w.apply('erase', 40, 40, 8);
    assert.equal(w.people.length, 0); assert.equal(w.tile(40, 40), T.GRASS);
});
test('save roundtrip preserves simulation, random state and independent arrays', () => {
    const w = new World(); w.apply('fire', 70, 50, 3);
    for (let i = 0; i < 200; i++) w.step(0.125);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
    assert.deepEqual(loaded.serialize(), w.serialize());
    for (let i = 0; i < 100; i++) { loaded.step(0.125); w.step(0.125); }
    assert.deepEqual(loaded.serialize(), w.serialize());
    loaded.tiles[0] = T.MOUNTAIN; assert.notEqual(loaded.tiles[0], w.tiles[0]);
});
test('corrupt and untrusted saves are rejected before replacing a world', () => {
    const original = new World().serialize();
    const mutations = [
        d => { d.version = 99; }, d => { d.tiles.pop(); }, d => { d.tiles[0] = 200; },
        d => { d.fire[0] = Infinity; }, d => { d.people[0].x = -1; },
        d => { d.people[0].village_id = 99999; }, d => { d.people[0].id = d.villages[0].id; },
        d => { d.villages[0].houses = [{ x: NaN, y: 0 }]; }, d => { d.name = 'x'.repeat(1000); },
        d => { d.animals[0].species = 'dragon'; }, d => { d.rng = 0; }
    ];
    for (const mutate of mutations) { const d = structuredClone(original); mutate(d); assert.throws(() => World.deserialize(d), /valid Genesis/); }
    assert.throws(() => World.deserialize(null));
    assert.throws(() => World.deserialize({}));
});
test('world populations remain bounded during repeated spawning', () => {
    const w = blank(); w.apply('grass', 50, 50, 12);
    for (let i = 0; i < 700; i++) { w.apply('human', 50, 50, 1); w.apply('sheep', 50, 50, 1); }
    assert.equal(w.people.length, 600); assert.equal(w.animals.length, 350);
});
test('race strengths change resources, housing, and population growth', () => {
    const w = blank();
    for (const [race, x] of [['elf', 20], ['human', 60], ['dwarf', 100], ['orc', 140]]) {
        w.apply('grass', x, 50, 10);
        w.apply(race, x, 50, 1);
        const village = w.villages.at(-1);
        const ground = race === 'elf' || (race === 'human' && x === 60) ? T.FOREST : race === 'dwarf' ? T.HILL : T.GRASS;
        w.set_tile(x, 50, ground);
        for (const person of w.people.filter(p => p.village_id === village.id)) {
            person.x = x; person.y = 50; person.dx = 0; person.dy = 0;
            person.decision = 5; person.gather = 3;
        }
    }
    const [elf, human, dwarf, orc] = w.villages;
    w.step(0.125);
    assert.equal(elf.wood - 15, 6);
    assert.equal(human.wood - 15, 3);
    assert.ok(elf.food > human.food);
    w.set_tile(60, 50, T.HILL);
    for (const person of w.people.filter(p => p.village_id === human.id || p.village_id === dwarf.id)) person.gather = 3;
    const human_food = human.food, dwarf_food = dwarf.food;
    w.step(0.125);
    assert.ok(dwarf.food - dwarf_food > human.food - human_food);
    elf.wood = human.wood = dwarf.wood = 5;
    elf.expansion_timer = human.expansion_timer = dwarf.expansion_timer = 11;
    w.step(0.125);
    assert.equal(dwarf.wood, 1);
    assert.equal(human.wood, 0);
    orc.birth_timer = human.birth_timer = 9;
    orc.food = human.food = 100;
    const orc_people = w.people.filter(p => p.village_id === orc.id).length;
    const human_people = w.people.filter(p => p.village_id === human.id).length;
    w.step(0.125);
    assert.equal(w.people.filter(p => p.village_id === orc.id).length, orc_people + 1);
    assert.equal(w.people.filter(p => p.village_id === human.id).length, human_people);
});
test('kingdom relations control fighting and survive old and new saves', () => {
    const w = blank(); w.apply('grass', 38, 40, 20);
    w.apply('human', 30, 40, 1); w.apply('orc', 45, 40, 1);
    const [first, second] = w.villages;
    assert.equal(w.relation_status(first.id, second.id), 'peace');
    assert.equal(w.set_relation(first.id, second.id, 'war'), true);
    const human = w.people.find(p => p.village_id === first.id);
    const orc = w.people.find(p => p.village_id === second.id);
    human.x = 37; human.y = 40; human.gather = 0;
    orc.x = 38; orc.y = 40; orc.gather = 0;
    w.step(0.125);
    assert.ok(human.health < orc.health);
    assert.ok(orc.health < 100);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
    assert.equal(loaded.relation_status(first.id, second.id), 'war');
    assert.equal(loaded.set_relation(first.id, second.id, 'peace'), true);
    assert.equal(loaded.relation_status(first.id, second.id), 'peace');
    assert.equal(loaded.set_relation(first.id, second.id, 'alliance'), true);
    const legacy = structuredClone(w.serialize()); delete legacy.relations;
    assert.equal(World.deserialize(legacy).relation_status(first.id, second.id), 'peace');
    const corrupt = structuredClone(w.serialize()); corrupt.relations[0].b = 99999;
    assert.throws(() => World.deserialize(corrupt), /valid Genesis/);
});
test('hundred-kingdom challenge starts 100 founders and records survival milestones', () => {
    const w = new World({ seed: 'challenge', scenario: 'hundred', preset: 'empty', inhabited: false });
    assert.equal(w.villages.length, 100);
    assert.equal(w.people.length, 300);
    assert.equal(w.year_length, 2);
    assert.deepEqual(w.laws, { rebellions: false, diplomacy: true });
    for (let i = 0; i < 1600; i++) w.step(0.125);
    assert.equal(w.year, 101);
    assert.equal(w.milestone, 1);
    assert.ok(w.events.some(event => event.text.startsWith('Year 100:')));
    assert.ok(w.relations.length > 0);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(w.serialize())));
    assert.deepEqual(loaded.serialize(), w.serialize());
    assert.equal(loaded.year, 101);
});
test('world laws are validated and old saves inherit safe defaults', () => {
    const w = new World();
    const old = w.serialize();
    delete old.scenario; delete old.year_length; delete old.laws; delete old.milestone;
    assert.deepEqual(World.deserialize(old).laws, { rebellions: false, diplomacy: false });
    const bad = w.serialize(); bad.laws.rebellions = 'yes';
    assert.throws(() => World.deserialize(bad), /valid Genesis/);
});
test('enabled rebellions split a mature populous kingdom and start a war', () => {
    const w = blank();
    w.apply('grass', 50, 50, 25);
    for (let i = 0; i < 5; i++) w.apply('human', 50, 50, 1);
    w.villages[0].age = 41;
    w.tick = 159;
    w.laws.rebellions = true;
    w.random = () => 0.1;
    w.step(0.125);
    assert.equal(w.villages.length, 2);
    assert.equal(w.people.filter(p => p.village_id === w.villages[1].id).length, 4);
    assert.equal(w.relation_status(w.villages[0].id, w.villages[1].id), 'war');
});
