import test from 'node:test';
import assert from 'node:assert/strict';
import { kingdom_plan, diplomatic_choice } from '../src/strategy.js';

const people = (count, soldiers) => Array.from({ length: count }, (_, i) => ({
    role: i < soldiers ? 'soldier' : 'civilian'
}));
test('hungry kingdoms prioritize recovery and seek allies instead of new wars', () => {
    const hungry = { food: 10, wood: 20 };
    const residents = people(20, 4);
    assert.equal(kingdom_plan(hungry, residents).mode, 'recover');
    assert.equal(diplomatic_choice(hungry, {}, residents, people(20, 6), 'peace'), 'alliance');
    assert.equal(diplomatic_choice(hungry, {}, residents, people(20, 6), 'war'), 'peace');
});
test('well-supplied kingdoms only initiate war with a clear army advantage', () => {
    const rich = { food: 200, wood: 100 };
    assert.equal(diplomatic_choice(rich, {}, people(20, 8), people(20, 2), 'peace'), 'war');
    assert.notEqual(diplomatic_choice(rich, {}, people(20, 2), people(20, 8), 'peace'), 'war');
});
