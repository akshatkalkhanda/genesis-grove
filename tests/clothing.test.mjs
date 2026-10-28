import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTFITS, outfit_style, draw_clothing } from '../src/clothing.js';
import { World, T } from '../src/simulation.js';

function populated_world() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'clothing-test' });
    world.tiles.fill(T.GRASS);
    const home = world.found_village(40, 40);
    for (let index = 0; index < 30; index++) assert.equal(world.add_person(40, 40, home.id), true);
    return world;
}

test('legacy outfit fallback is stable, read-only and consumes no randomness', () => {
    const people = [{ id: 1 }, { id: 19, name: 'Legacy person' }, { id: 829 }];
    const before = structuredClone(people);
    const random = Math.random;
    Math.random = () => { throw new Error('Outfit fallback must not consume randomness'); };
    try {
        for (const person of people) {
            const first = outfit_style(person);
            assert.ok(Object.hasOwn(OUTFITS, first));
            assert.equal(outfit_style(person), first);
        }
    } finally { Math.random = random; }
    assert.deepEqual(people, before);
});

test('new people receive both clothing styles and styles persist through save/load', () => {
    const world = populated_world();
    const styles = new Set(world.people.map(person => person.outfit_style));
    assert.deepEqual(styles, new Set(['male', 'female']));
    assert.ok(world.people.every(person => Object.hasOwn(OUTFITS, person.outfit_style)));

    const expected = world.people.map(person => person.outfit_style);
    const loaded = World.deserialize(world.serialize());
    assert.deepEqual(loaded.people.map(person => person.outfit_style), expected);
});

test('legacy saves without outfit_style receive repeatable ID-based defaults', () => {
    const world = populated_world();
    const legacy = world.serialize();
    for (const person of legacy.people) delete person.outfit_style;
    const original = structuredClone(legacy);

    const first = World.deserialize(legacy);
    const second = World.deserialize(legacy);
    const expected = legacy.people.map(person => outfit_style({ id: person.id }));
    assert.deepEqual(first.people.map(person => person.outfit_style), expected);
    assert.deepEqual(second.people.map(person => person.outfit_style), expected);
    assert.deepEqual(legacy, original, 'Loading an older save does not mutate its input');
});

test('save validation rejects malformed, unknown and null clothing styles', () => {
    const valid = populated_world().serialize();
    for (const style of [[], ['female'], 'other-style', null]) {
        const malformed = structuredClone(valid);
        malformed.people[0].outfit_style = style;
        assert.throws(() => World.deserialize(malformed), /valid Genesis Grove world file/,
            `rejects outfit_style ${JSON.stringify(style)}`);
    }
});

test('clothing drawing changes the skirt hem silhouette without mutating a person', () => {
    const draw = style => {
        const calls = [];
        const context = { fillStyle: '', fillRect(x, y, width, height) {
            calls.push({ color: this.fillStyle, x, y, width, height });
        } };
        const person = { id: style === 'female' ? 1 : 20, outfit_style: style };
        const before = structuredClone(person);
        draw_clothing(context, person, 10, 12, '#abcdef', 0);
        assert.deepEqual(person, before);
        return calls;
    };
    const male = draw('male'), female = draw('female');
    assert.notDeepEqual(female, male);
    assert.ok(female.some(call => call.color === '#abcdef' && call.x === 6 && call.y === 12
        && call.width === 8 && call.height === 3), 'female style draws a wider skirt silhouette');
    assert.ok(female.some(call => call.color === '#213129' && call.x === 6 && call.y === 14
        && call.width === 8 && call.height === 1), 'female style draws the wide hem');
    assert.ok(!male.some(call => call.color === '#abcdef' && call.width === 8),
        'male style retains the narrower tunic silhouette');
});
