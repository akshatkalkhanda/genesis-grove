import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, WIDTH, HEIGHT, TECH_AGES, technology_level } from '../src/simulation.js';
const blank = () => new World({ preset: 'empty', inhabited: false });
test('same seed gives identical terrain, settlements and deterministic evolution', () => {
    const a = new World({ seed: 'known world' }), b = new World({ seed: 'known world' });
    assert.deepEqual(a.serialize(), b.serialize());
    for (let i = 0; i < 120; i++) { a.step(0.125); b.step(0.125); }
    assert.deepEqual(a.serialize(), b.serialize());
    assert.notDeepEqual(a.tiles, new World({ seed: 'different world' }).tiles);
});
test('kingdom banners differ and technology requires ore to advance', () => {
    const world = new World();
    assert.equal(new Set(world.villages.map(v => v.color)).size, 3);
    const kingdom = world.villages[0];
    kingdom.tech_points = 7.999;
    kingdom.ore.copper = 3;
    world.step(0.125);
    assert.equal(technology_level(kingdom), 1);
    assert.equal(kingdom.ore.copper, 0);
    assert.ok(world.events.some(event => event.text.includes('Copper Age')));
    assert.deepEqual(TECH_AGES.map(age => age.name), ['Stone Age', 'Copper Age', 'Bronze Age', 'Iron Age', 'Steel Age']);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    assert.equal(loaded.villages[0].tech_points, kingdom.tech_points);
    const legacy = world.serialize(); delete legacy.villages[0].tech_points;
    assert.ok(Number.isFinite(World.deserialize(legacy).villages[0].tech_points));
});
test('ore tools place persistent deposits and forges equip individual people', () => {
    const world = blank(); world.apply('grass', 40, 40, 10); world.apply('human', 40, 40, 1);
    const kingdom = world.villages[0], person = world.people[0];
    world.apply('copper', 41, 40, 1);
    assert.equal(world.ores[world.index(41, 40)], 1);
    kingdom.research_level = 1; kingdom.ore.copper = 1; kingdom.forge_timer = 9.9;
    world.step(0.125);
    assert.equal(person.weapon_level, 1);
    assert.equal(kingdom.ore.copper, 0);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    assert.equal(loaded.ores[loaded.index(41, 40)], 1);
    assert.equal(loaded.people[0].weapon_level, 1);
    const old_save = new World().serialize(); delete old_save.ores;
    const upgraded = World.deserialize(old_save);
    assert.ok(upgraded.ores.some(ore => ore > 0), 'older mountain and hill worlds receive natural ore deposits');
});
test('advanced weapons inflict more damage in the same fight', () => {
    const basic = blank(); basic.apply('grass', 40, 40, 16);
    basic.apply('human', 36, 40, 1); basic.apply('orc', 45, 40, 1);
    const [attacker, defender] = basic.villages;
    basic.set_relation(attacker.id, defender.id, 'war');
    for (const person of basic.people.filter(p => p.village_id === attacker.id)) { person.x = 40; person.y = 40; person.gather = 0; }
    for (const person of basic.people.filter(p => p.village_id === defender.id)) { person.x = 41; person.y = 40; person.gather = 0; }
    const advanced = World.deserialize(JSON.parse(JSON.stringify(basic.serialize())));
    advanced.villages[0].research_level = 4;
    for (const person of advanced.people.filter(p => p.village_id === attacker.id)) person.weapon_level = 4;
    basic.step(0.125); advanced.step(0.125);
    const health = world => world.people.filter(p => p.village_id === defender.id).map(p => p.health);
    assert.ok(health(advanced).some((value, index) => value < health(basic)[index]));
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
    assert.deepEqual(w.laws, { rebellions: false, diplomacy: true, expansion: true });
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
    assert.deepEqual(World.deserialize(old).laws, { rebellions: false, diplomacy: false, expansion: false });
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
test('settlers cross water by ship and establish another town for their kingdom', () => {
    const w = blank();
    w.apply('grass', 25, 35, 13); w.apply('grass', 110, 75, 13);
    for (let i = 0; i < 3; i++) w.apply('human', 25, 35, 1);
    const kingdom = w.villages[0];
    for (const person of w.people) person.age = 10;
    assert.equal(w.launch_colony(kingdom.id, 110, 75), true);
    assert.equal(w.voyages[0].kind, 'ship');
    assert.equal(w.people.filter(p => p.voyage_id === w.voyages[0].id).length, 3);
    w.advance_voyages(w.voyages[0].duration / 2);
    assert.deepEqual(World.deserialize(JSON.parse(JSON.stringify(w.serialize()))).serialize(), w.serialize());
    const broken = structuredClone(w.serialize()); broken.voyages[0].crew_ids[0] = 99999;
    assert.throws(() => World.deserialize(broken), /valid Genesis/);
    w.advance_voyages(w.voyages[0].duration);
    assert.equal(w.voyages.length, 0);
    assert.equal(w.colonies.length, 1);
    assert.equal(w.colonies[0].kingdom_id, kingdom.id);
    assert.equal(w.people.filter(p => p.home_id === w.colonies[0].id).length, 3);
    assert.equal(w.stats().towns, 2);
    assert.deepEqual(World.deserialize(JSON.parse(JSON.stringify(w.serialize()))).serialize(), w.serialize());
});
test('sieges capture towns and capitals, preserving the conquered population', () => {
    const w = blank(); w.apply('grass', 55, 45, 37);
    w.apply('human', 35, 45, 1); w.apply('orc', 70, 45, 1);
    const [attacker, defender] = w.villages;
    const colony = w.found_colony(defender.id, 58, 45);
    w.add_person(58, 45, defender.id, 'orc');
    w.people.at(-1).home_id = colony.id;
    assert.equal(w.set_relation(attacker.id, defender.id, 'war'), true);
    for (const person of w.people.filter(p => p.village_id === attacker.id)) { person.x = 58; person.y = 45; }
    for (let i = 1; i <= 8; i++) { w.tick = i * 8; w.resolve_sieges(); }
    assert.equal(colony.kingdom_id, attacker.id);
    assert.ok(w.people.some(p => p.home_id === colony.id && p.village_id === attacker.id));
    for (const person of w.people.filter(p => p.village_id === attacker.id)) { person.x = defender.x; person.y = defender.y; }
    for (const person of w.people.filter(p => p.village_id === defender.id)) { person.x = 40; person.y = 45; }
    for (let i = 9; i <= 23; i++) { w.tick = i * 8; w.resolve_sieges(); }
    assert.equal(defender.alive, false);
    assert.ok(w.people.every(p => p.village_id === attacker.id));
    assert.ok(w.colonies.some(c => c.name === defender.name && c.kingdom_id === attacker.id));
    assert.deepEqual(World.deserialize(JSON.parse(JSON.stringify(w.serialize()))).serialize(), w.serialize());
});
