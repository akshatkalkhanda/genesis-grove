import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, WIDTH, HEIGHT, TECH_AGES, RACES, ANIMALS, technology_level } from '../src/simulation.js';
const blank = () => new World({ preset: 'empty', inhabited: false });
test('generated wildlands contain colorful biomes and preserve them through saves', () => {
    const world = new World({ seed: 'color-world', preset: 'wildlands' });
    assert.equal(new Set(world.villages.map(v => v.race)).size, 8);
    for (const terrain of [T.JUNGLE, T.SAVANNA, T.SNOW, T.MAPLE, T.MUSHROOM, T.CRYSTAL, T.CELESTIAL, T.DESERT]) {
        const index = world.tiles.findIndex(tile => tile === terrain);
        assert.ok(index >= 0, `missing biome ${terrain}`);
        assert.ok(world.walkable(index % WIDTH, Math.floor(index / WIDTH)));
    }
    assert.deepEqual(World.deserialize(world.serialize()).tiles, world.tiles);
});
test('biomes affect survival, pollinators restore soil, and snow resists wildfire', () => {
    const world = blank(); world.tiles.fill(T.SNOW);
    const native = world.found_village(40, 40, 'wolfkin');
    world.add_person(40, 40, native.id, 'wolfkin');
    native.food = 0;
    world.people[0].gather = 3;
    world.people[0].decision = 10;
    world.step(0.125);
    assert.ok(native.food > 1, 'wolfkin can gather enough food on snow');
    world.apply('fire', 40, 40, 2);
    assert.equal(world.fire[world.index(40, 40)], 0);
    world.apply('celestial', 60, 60, 3);
    const tile = world.index(60, 60);
    world.fertility[tile] = 0.2;
    world.add_animal(60.5, 60.5, 'butterfly');
    world.step(0.125);
    assert.ok(world.fertility[tile] > 0.2);
});
test('all peoples and wildlife can be placed, simulated, and restored', () => {
    const world = blank();
    world.tiles.fill(T.GRASS);
    let x = 10;
    for (const race of Object.keys(RACES)) {
        world.apply(race, x, 40, 1);
        x += 15;
    }
    for (const species of ANIMALS) world.add_animal(40, 70, species);
    assert.equal(new Set(world.people.map(p => p.race)).size, 11);
    assert.equal(world.animals.length, 18);
    for (let tick = 0; tick < 16; tick++) world.step(0.125);
    const restored = World.deserialize(world.serialize());
    assert.deepEqual(restored.people, world.people);
    assert.deepEqual(restored.animals, world.animals);
    assert.equal(world.add_animal(40, 70, 'unknown'), false);
});
test('individual inspection finds the nearest living unit and ignores ship passengers', () => {
    const world = blank(); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(40, 40);
    world.add_person(40, 40, kingdom.id);
    world.add_animal(45, 40, 'fox');
    assert.equal(world.unit_near(40, 40).kind, 'person');
    assert.equal(world.unit_near(45, 40).unit.species, 'fox');
    world.people[0].voyage_id = 123;
    assert.equal(world.unit_near(40, 40), null);
    world.animals[0].health = 0;
    assert.equal(world.unit_near(45, 40), null);
});
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
test('later kingdoms can rediscover an age already reached by a fallen kingdom', () => {
    const world = blank();
    world.apply('grass', 40, 40, 20);
    const earlier = world.found_village(35, 40);
    const successor = world.found_village(45, 40);
    world.add_person(45, 40, successor.id);
    earlier.alive = false;
    earlier.research_level = 2;
    successor.tech_points = TECH_AGES[1].threshold;
    const restored = World.deserialize(world.serialize());
    restored.step(0.125);
    assert.equal(technology_level(restored.villages[1]), 1);
    assert.equal(restored.villages[1].ore.copper, 0);
});
test('rebellions do not reset a mature world to the Stone Age', () => {
    const world = new World();
    world.laws.rebellions = true;
    world.laws.expansion = true;
    for (let tick = 0; tick < 16000; tick++) world.step(0.125);
    assert.equal(world.year, 101);
    assert.ok(world.villages.some(v => v.alive));
    assert.ok(world.villages.filter(v => v.alive).every(v => technology_level(v) >= 2));
});
test('ore tools place persistent deposits and forges equip individual people', () => {
    const world = blank(); world.apply('grass', 40, 40, 10); world.apply('human', 40, 40, 1);
    const kingdom = world.villages[0], person = world.people[0];
    world.apply('copper', 41, 40, 1);
    assert.equal(world.ores[world.index(41, 40)], 1);
    world.add_person(40, 40, kingdom.id, 'human'); world.add_person(40, 40, kingdom.id, 'human');
    kingdom.research_level = 1; kingdom.ore.copper = 6; kingdom.forge_timer = 9.9;
    world.step(0.125);
    assert.equal(person.weapon_level, 1);
    assert.equal(kingdom.ore.copper, 5);
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
    for (const person of basic.people.filter(p => p.village_id === attacker.id)) { person.x = 40; person.y = 40; person.gather = 0; person.role = 'soldier'; }
    for (const person of basic.people.filter(p => p.village_id === defender.id)) { person.x = 41; person.y = 40; person.gather = 0; }
    const advanced = World.deserialize(JSON.parse(JSON.stringify(basic.serialize())));
    advanced.villages[0].research_level = 4;
    for (const person of advanced.people.filter(p => p.village_id === attacker.id)) person.weapon_level = 4;
    basic.step(0.125); advanced.step(0.125);
    const health = world => world.people.filter(p => p.village_id === defender.id).map(p => p.health);
    assert.ok(health(advanced).some((value, index) => value < health(basic)[index]));
});
test('barracks train soldiers who consume supplies and leave civilians out of combat', () => {
    const world = blank(); world.apply('grass', 45, 45, 18);
    const kingdom = world.found_village(40, 45);
    for (let i = 0; i < 9; i++) { world.add_person(40, 45, kingdom.id); world.people.at(-1).age = 10; }
    kingdom.food = 60; kingdom.wood = 40; kingdom.expansion_timer = 11; kingdom.training_timer = 7.9;
    world.step(0.125);
    assert.equal(kingdom.barracks, 1);
    assert.equal(world.stats().soldiers, 1);
    assert.ok(kingdom.food < 60);
    const enemy = world.found_village(48, 45, 'orc'); world.add_person(48, 45, enemy.id, 'orc');
    const soldier = world.people.find(p => p.village_id === kingdom.id && p.role === 'soldier');
    const civilian = world.people.find(p => p.village_id === enemy.id);
    world.set_relation(kingdom.id, enemy.id, 'war');
    soldier.x = 44; soldier.y = 45; soldier.gather = 0;
    civilian.x = 45; civilian.y = 45; civilian.gather = 0;
    world.step(0.125);
    assert.ok(civilian.health < 100);
    assert.equal(soldier.health, 100);
});
test('town claims leave wilderness unclaimed and armies march together toward reachable enemies', () => {
    const world = blank();
    for (const x of [35, 45, 55, 65]) world.apply('grass', x, 40, 10);
    world.apply('grass', 110, 40, 10);
    const first = world.found_village(35, 40), second = world.found_village(65, 40);
    const overseas = world.found_village(110, 40);
    assert.equal(world.territory_at(35, 40), first.id);
    assert.equal(world.territory_at(65, 40), second.id);
    assert.equal(world.territory_at(50, 40), null);
    assert.equal(world.territory_at(110, 40), overseas.id);
    for (const x of [35, 35.3]) {
        world.add_person(x, 40, first.id);
        const soldier = world.people.at(-1); soldier.role = 'soldier'; soldier.age = 10;
    }
    for (let i = 0; i < 5; i++) world.add_person(65 + i * 0.4, 40, second.id);
    world.add_person(110, 40, overseas.id);
    world.set_relation(first.id, second.id, 'war');
    world.set_relation(first.id, overseas.id, 'war');
    const before = world.people.slice(0, 2).map(p => p.x);
    world.step(0.125);
    const army = world.armies.find(a => a.kingdom_id === first.id);
    assert.equal(army.count, 2);
    assert.equal(army.target_id, second.id);
    assert.ok(world.people.slice(0, 2).every((p, index) => p.x > before[index]));
    const loaded = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    loaded.step(0.125);
    assert.equal(loaded.armies.find(a => a.kingdom_id === first.id).target_id, second.id);
    for (let i = 0; i < 300 && second.alive; i++) world.step(0.125);
    assert.equal(second.alive, false, 'the marching group can reach and capture its target');
    assert.equal(world.territory_at(65, 40), first.id, 'captured towns change visible claims');
    world.step(0.125);
    assert.equal(world.armies.find(a => a.kingdom_id === first.id).target_id, null, 'overseas targets need a future naval system');
});
test('miners exhaust deposits and peaceful kingdoms deliver real supplies by ship', () => {
    const world = blank(); world.apply('grass', 30, 40, 8); world.apply('grass', 70, 40, 8);
    const first = world.found_village(30, 40), second = world.found_village(70, 40);
    for (let i = 0; i < 3; i++) world.add_person(30, 40, first.id);
    world.add_person(70, 40, second.id);
    world.ores.fill(0); world.ores[world.index(31, 40)] = 1;
    first.mine_timer = 7.9; world.step(0.125);
    assert.equal(first.ore.copper, 4);
    assert.equal(world.ores[world.index(31, 40)], 0);
    first.food = 80; second.food = 5;
    world.schedule_trades();
    assert.equal(world.trades.length, 1);
    assert.equal(world.trades[0].kind, 'ship');
    assert.equal(first.food, 74);
    assert.equal(second.food, 5);
    const loaded = World.deserialize(JSON.parse(JSON.stringify(world.serialize())));
    assert.deepEqual(loaded.serialize(), world.serialize());
    loaded.advance_trades(loaded.trades[0].duration);
    assert.equal(loaded.villages[1].food, 11);
    assert.equal(loaded.trades.length, 0);
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
    assert.equal(elf.wood - 15, 7);
    assert.equal(human.wood - 15, 4);
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
    human.role = orc.role = 'soldier';
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
    w.villages[0].research_level = 3;
    w.villages[0].tech_points = 80;
    w.tick = 159;
    w.laws.rebellions = true;
    w.random = () => 0.1;
    w.step(0.125);
    assert.equal(w.villages.length, 2);
    assert.equal(w.people.filter(p => p.village_id === w.villages[1].id).length, 4);
    assert.equal(w.villages[1].research_level, 3);
    assert.ok(w.villages[1].tech_points >= 80);
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
    for (const person of w.people.filter(p => p.village_id === attacker.id)) { person.x = 58; person.y = 45; person.role = 'soldier'; }
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
