import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAIT_CATALOG, MAX_CHARACTER_TRAITS, apply_trait, initialize_traits,
    has_trait, trait_modifiers, trait_probability, valid_character_traits } from '../src/character_traits.js';
import { creature_stats, initialize_creature, develop_creature } from '../src/creatures.js';
import { socialize, initialize_child, validate_society_person } from '../src/society.js';
import { health_risks, apply_damage } from '../src/health.js';
import { initialize_daily_life, advance_daily_life, attempt_theft } from '../src/daily_life.js';
import { World, T } from '../src/simulation.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'character-traits' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(40, 40);
    for (let index = 0; index < 2; index++) world.add_person(40 + index * 0.25, 40, home.id);
    const [person, companion] = world.people;
    for (const unit of [person, companion]) {
        unit.trait_ids = []; unit.role = 'civilian'; unit.age = world.year_length * 20;
        initialize_daily_life(unit);
    }
    return { world, home, person, companion };
}

test('Phase1 catalogue has fourteen configurable definitions with bounded metadata and symmetric conflicts', () => {
    const expected = ['lucky', 'unlucky', 'strong', 'weak', 'fast', 'slow', 'genius', 'stupid',
        'long_lived', 'regeneration', 'thief', 'honest', 'peaceful', 'aggressive'];
    assert.deepEqual(TRAIT_CATALOG.map(trait => trait.id), expected);
    assert.equal(new Set(expected).size, TRAIT_CATALOG.length);
    for (const trait of TRAIT_CATALOG) {
        assert.ok(trait.label && trait.group && trait.category && trait.description);
        assert.ok(trait.effects && typeof trait.effects === 'object');
        assert.ok(trait.inheritance_probability >= 0 && trait.inheritance_probability <= 1);
        for (const conflict of trait.conflicts) {
            assert.ok(TRAIT_CATALOG.find(other => other.id === conflict)?.conflicts.includes(trait.id));
        }
    }
    assert.equal(MAX_CHARACTER_TRAITS, 12);
});

test('setting traits removes conflicts atomically and malformed, unknown and oversized sets fail validation', () => {
    const unit = { id: 2, trait: 'brave', heritage_trait: 'curious' };
    assert.equal(apply_trait(unit, 'strong'), true);
    assert.equal(apply_trait(unit, 'weak'), true);
    assert.deepEqual(unit.trait_ids, ['weak']);
    assert.equal(apply_trait(unit, 'thief'), true); assert.equal(apply_trait(unit, 'honest'), true);
    assert.equal(has_trait(unit, 'thief'), false); assert.equal(has_trait(unit, 'honest'), true);
    assert.equal(apply_trait(unit, 'honest'), true, 'a valid no-op is accepted');
    assert.equal(apply_trait(unit, 'honest', false), true); assert.equal(has_trait(unit, 'honest'), false);
    assert.equal(unit.trait, 'brave'); assert.equal(unit.heritage_trait, 'curious');
    for (const ids of [null, 'strong', ['teleporter'], ['strong', 'strong'], ['strong', 'weak'],
        ['peaceful', 'aggressive'], ['long_liver', 'long_lived'], Array(13).fill('strong')]) {
        const invalid = { trait_ids: ids }, before = structuredClone(invalid);
        assert.equal(valid_character_traits(invalid), false);
        assert.equal(apply_trait(invalid, 'fast'), false);
        assert.deepEqual(invalid, before);
    }
    const before = structuredClone(unit);
    assert.equal(apply_trait(unit, 'missing'), false); assert.deepEqual(unit, before);
    assert.equal(apply_trait(unit, 'fast', 'yes'), false); assert.deepEqual(unit, before);
});

test('legacy traits remain empty while new common defaults are deterministic, safe and conflict-free', () => {
    const original_random = Math.random;
    Math.random = () => { throw new Error('Initialization or projection consumed randomness'); };
    try {
        const legacy = initialize_creature({ id: 5, age: 400, health: 100,
            name: 'Existing Citizen', trait: 'careful', heritage_trait: 'hardy' });
        assert.deepEqual(legacy.trait_ids, []);
        assert.equal(legacy.name, 'Existing Citizen'); assert.equal(legacy.trait, 'careful');
        for (let id = 1; id <= 100; id++) {
            const first = initialize_traits({ id }, { new_person: true });
            const second = initialize_traits({ id }, { new_person: true });
            assert.deepEqual(first, second);
            assert.ok(first.trait_ids.length >= 1 && first.trait_ids.length <= 2);
            assert.ok(valid_character_traits(first));
            assert.ok(first.trait_ids.every(key => TRAIT_CATALOG.find(trait => trait.id === key).safe_auto));
            assert.ok(!first.trait_ids.some(key => ['regeneration', 'thief', 'aggressive'].includes(key)));
            const before = structuredClone(first); initialize_traits(first, { new_person: true });
            trait_modifiers(first); trait_probability(first, 0.2);
            assert.deepEqual(first, before);
        }
        const animal = initialize_traits({ id: 8, species: 'wolf' }, { new_person: true });
        assert.deepEqual(animal.trait_ids, []);
    } finally { Math.random = original_random; }
    const alias = initialize_traits({ trait_ids: ['long_liver'] });
    assert.deepEqual(alias.trait_ids, ['long_lived']); assert.ok(has_trait(alias, 'long_liver'));
});

test('strength, intelligence and earned learning affect actual creature stats without replacing primary heritage', () => {
    const unit = initialize_creature({ id: 5, trait: 'curious', heritage_trait: 'hardy',
        age: 400, health: 100, xp: 0 });
    const original = creature_stats(unit);
    apply_trait(unit, 'strong'); apply_trait(unit, 'genius');
    let current = creature_stats(unit);
    assert.equal(current.strength, original.strength + 4);
    assert.equal(current.intelligence, original.intelligence + 5);
    assert.equal(current.max_health, original.max_health);
    develop_creature(unit, 0, 20, 10); assert.equal(unit.xp, 11.5);
    apply_trait(unit, 'weak'); apply_trait(unit, 'stupid'); unit.xp = 0;
    current = creature_stats(unit);
    assert.equal(current.strength, original.strength - 4);
    assert.equal(current.intelligence, original.intelligence - 4);
    develop_creature(unit, 0, 20, 10); assert.equal(unit.xp, 8);
    assert.equal(unit.trait, 'curious'); assert.equal(unit.heritage_trait, 'hardy');
    assert.equal(trait_modifiers({ trait_ids: ['fast'] }).movement, 1.25);
    assert.equal(trait_modifiers({ trait_ids: ['slow'] }).movement, 0.8);
    assert.equal(trait_modifiers({ trait_ids: ['regeneration'] }).regen, 0.5);
    assert.equal(trait_modifiers({ trait_ids: ['peaceful'] }).aggression, 'peaceful');
    assert.equal(trait_modifiers({ trait_ids: ['aggressive'] }).aggression, 'aggressive');
});

test('luck modifies bounded probabilities and reproducible seeded opportunities rather than promising outcomes', () => {
    const lucky = { trait_ids: ['lucky'] }, unlucky = { trait_ids: ['unlucky'] };
    assert.equal(trait_probability(lucky, 0.5), 0.6);
    assert.equal(trait_probability(unlucky, 0.5), 0.4);
    for (const base of [-1, 0, 0.01, 0.5, 1, 10, NaN, Infinity]) {
        for (const unit of [lucky, unlucky, {}]) {
            assert.ok(trait_probability(unit, base) >= 0 && trait_probability(unit, base) <= 1);
        }
    }
    const world = new World({ preset: 'empty', inhabited: false, seed: 'opportunity-proof' });
    let good = 0, normal = 0, poor = 0;
    for (let index = 0; index < 1000; index++) {
        const roll = world.random();
        if (roll < trait_probability(lucky, 0.2)) good++;
        if (roll < 0.2) normal++;
        if (roll < trait_probability(unlucky, 0.2)) poor++;
    }
    assert.ok(good > normal && normal > poor);
    const before = structuredClone(lucky); trait_modifiers(lucky); trait_probability(lucky, 0.2);
    assert.deepEqual(lucky, before);
});

test('long-lived health risks match the delayed age threshold and direct damage remains real', () => {
    const { world, home, person } = fixture();
    person.age = world.year_length * 90;
    assert.ok(health_risks(world, person, home).includes('Age-related decline'));
    apply_trait(person, 'long_lived');
    assert.ok(!health_risks(world, person, home).includes('Age-related decline'));
    person.age = world.year_length * 111;
    assert.ok(health_risks(world, person, home).includes('Age-related decline'));
    person.health = 50; apply_damage(world, person, 10, 'combat');
    assert.equal(person.health, 40); assert.equal(person.health_history[0].amount, 10);
});

test('honesty changes actual social affinity gains and primary-trait child inheritance remains intact', () => {
    const { world, home, person, companion } = fixture(); apply_trait(person, 'honest');
    socialize(person, companion, 2);
    assert.equal(companion.relationships.find(record => record.id === person.id).affinity, 3);
    assert.equal(person.relationships.find(record => record.id === companion.id).affinity, 2);
    person.trait = 'curious'; companion.trait = 'hardy';
    const child = initialize_child({ id: world.next_id, age: 0, health: 100, village_id: home.id },
        [person, companion], home, () => 0, world.year);
    assert.equal(child.trait, 'curious'); assert.equal(child.heritage_trait, 'hardy');
    assert.equal(child.family_id, person.family_id);
    assert.deepEqual(child.trait_ids, [], 'additional inheritance belongs to the later phase');
    assert.ok(validate_society_person(child, world.next_id + 1));
});

test('theft transfers finite food/timber cargo, respects capacities and reduces victim trust', () => {
    const { world, home, person, companion } = fixture(); apply_trait(person, 'thief');
    companion.daily_life.cargo.food = 3; socialize(person, companion, 10);
    const before = home.food + person.daily_life.cargo.food + companion.daily_life.cargo.food;
    const stolen = attempt_theft(world, person, companion);
    assert.deepEqual(stolen, { good: 'food', amount: 1, victim_id: companion.id });
    assert.equal(person.daily_life.cargo.food, 1); assert.equal(companion.daily_life.cargo.food, 2);
    assert.equal(home.food + person.daily_life.cargo.food + companion.daily_life.cargo.food, before);
    assert.equal(person.trait_thefts, 1);
    assert.equal(companion.relationships.find(record => record.id === person.id).affinity, 5);
    person.daily_life.cargo.food = 12; companion.daily_life.cargo.food = 0;
    person.daily_life.cargo.wood = 7.75; companion.daily_life.cargo.wood = 1;
    assert.equal(attempt_theft(world, person, companion).amount, 0.25);
    assert.equal(person.daily_life.cargo.wood, 8); assert.equal(companion.daily_life.cargo.wood, 0.75);
    assert.equal(attempt_theft(world, person, companion), null);
    apply_trait(person, 'honest'); assert.equal(attempt_theft(world, person, companion), null);
});

test('theft excludes absent, sick, minor, military, remote and unreachable participants', () => {
    for (const alter of [
        unit => { unit.health = 0; }, unit => { unit.role = 'soldier'; },
        unit => { unit.age = 17 * 20; }, unit => { unit.recovering = true; },
        unit => { unit.voyage_id = 5; }, unit => { unit.prisoner_of = 5; },
        unit => { unit.medical_role = 'doctor'; }, unit => { unit.x += 5; }
    ]) {
        const { world, person, companion } = fixture(); apply_trait(person, 'thief');
        companion.daily_life.cargo.food = 3; alter(companion);
        assert.equal(attempt_theft(world, person, companion), null);
        assert.equal(companion.daily_life.cargo.food, 3);
    }
    const { world, person, companion } = fixture(); apply_trait(person, 'thief');
    companion.daily_life.cargo.food = 3;
    world.machines.push({ crew_id: companion.id });
    assert.equal(attempt_theft(world, person, companion), null); world.machines = [];
    person.x = 39; companion.x = 41;
    for (let y = 0; y < 128; y++) world.set_tile(40, y, T.MOUNTAIN);
    assert.equal(attempt_theft(world, person, companion), null);
});

test('a completed social encounter steals only once and saved traits/counters survive independent roundtrip', () => {
    const { world, home, person, companion } = fixture(); apply_trait(person, 'thief');
    companion.daily_life.cargo.food = 3;
    Object.assign(person.daily_life, { phase: 'social', timer: 3.9, partner_id: companion.id });
    advance_daily_life(world, person, home, home, 0.2, 130);
    assert.equal(person.trait_thefts, 1); assert.equal(person.daily_life.cargo.food, 1);
    const restored = World.deserialize(world.serialize()), next = restored.people[0];
    assert.deepEqual(next.trait_ids, ['thief']); assert.equal(next.trait_thefts, 1);
    advance_daily_life(restored, next, restored.villages[0], restored.villages[0], 0.2, 130);
    assert.equal(next.trait_thefts, 1); assert.equal(next.daily_life.cargo.food, 1);
    const legacy = world.serialize(); delete legacy.people[0].trait_ids;
    assert.deepEqual(World.deserialize(legacy).people[0].trait_ids, []);
    for (const value of [['strong', 'weak'], ['not_real'], null, ['fast', 'fast']]) {
        const invalid = world.serialize(); invalid.people[0].trait_ids = value;
        assert.throws(() => World.deserialize(invalid), /valid Genesis/);
    }
    for (const value of [-1, Infinity, 1e6 + 1, 0.5]) {
        assert.equal(valid_character_traits({ trait_ids: [], trait_thefts: value }), false);
    }
});


test('successful theft records one optional event for each affected person and failed attempts record none', () => {
    const { world, person, companion } = fixture(); apply_trait(person, 'thief');
    companion.daily_life.cargo.food = 1;
    const events = [];
    world.note_character_event = (unit, text) => events.push({ id: unit.id, text });
    assert.ok(attempt_theft(world, person, companion));
    assert.equal(events.length, 2);
    assert.deepEqual(events.map(event => event.id), [person.id, companion.id]);
    assert.match(events[0].text, /Pilfered 1 food/);
    assert.match(events[1].text, /took 1 food/);
    assert.equal(attempt_theft(world, person, companion), null); assert.equal(events.length, 2);
    delete world.note_character_event;
});
