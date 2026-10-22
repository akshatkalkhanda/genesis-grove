import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ALL_FOOD_SOURCES, CANONICAL_RACES, DEFAULT_DIET, DIET_CATALOG, MAX_FOOD_STORES,
    add_food, consume_food, diet_food_available, initialize_diet, pack_food, receive_food,
    reconcile_food, valid_diet, valid_food_cargo, valid_food_stores
} from '../src/diets.js';

const unit = (diet_id = DEFAULT_DIET, race = 'human') => ({ diet_id, race });
const kingdom = (food, food_stores) => ({ id: 1, food, food_stores, wood: 17, ore: { iron: 4 } });

test('catalogue defines three Phase 1 diets and legacy citizens receive the safe omnivore default', () => {
    assert.deepEqual(DIET_CATALOG.map(entry => entry.id), ['herbivore', 'carnivore', 'omnivore']);
    assert.equal(new Set(DIET_CATALOG.map(entry => entry.id)).size, 3);
    assert.ok(DIET_CATALOG.every(entry => entry.group === 'Diet'
        && entry.label && entry.description && Array.isArray(entry.sources)));
    assert.equal(initialize_diet({}), 'omnivore');
    assert.equal(initialize_diet({ diet_id: 'carnivore' }), 'carnivore');
    assert.equal(valid_diet({}), true, 'legacy records are valid before migration');
    assert.equal(valid_diet({ diet_id: 'frugivore' }), false, 'future specialist diets stay unavailable');
});

test('legacy food becomes generic plant food and direct generic deltas reconcile deterministically', () => {
    const stores = kingdom(23, undefined);
    assert.equal(reconcile_food(stores), 23);
    assert.deepEqual(stores.food_stores, { plant: 23 });
    assert.equal(add_food(stores, 'fruit', 4), 4);
    stores.food += 3; // Legacy producers still write the shared total directly.
    assert.equal(reconcile_food(stores), 30);
    assert.deepEqual(stores.food_stores, { plant: 26, fruit: 4 });
    stores.food -= 7;
    assert.equal(reconcile_food(stores), 23);
    assert.deepEqual(stores.food_stores, { plant: 19, fruit: 4 },
        'a negative delta drains in the documented stable source order');
    assert.equal(stores.wood, 17); assert.deepEqual(stores.ore, { iron: 4 });
});

test('food additions validate their source and amount and stop at the aggregate cap', () => {
    const stores = kingdom(MAX_FOOD_STORES - 2, undefined);
    assert.equal(add_food(stores, 'berries', 1), 0);
    assert.equal(add_food(stores, 'fish', NaN), 0);
    assert.equal(add_food(stores, 'fish', -1), 0);
    assert.equal(add_food(stores, 'fish', 5), 2);
    assert.equal(stores.food, MAX_FOOD_STORES);
    assert.deepEqual(stores.food_stores, { plant: MAX_FOOD_STORES - 2, fish: 2 });
    assert.ok(valid_food_stores(stores));
});

test('typed food cargo packs and receives an exact source mix without creating food', () => {
    const sender = kingdom(10, { plant: 6, meat: 4 });
    const receiver = kingdom(2, { fish: 2 });
    const before_total = sender.food + receiver.food;
    const cargo = pack_food(sender, 7);
    assert.deepEqual(cargo, { amount: 7, food_stores: { plant: 6, meat: 1 } });
    assert.equal(sender.food, 3); assert.deepEqual(sender.food_stores, { meat: 3 });
    assert.ok(valid_food_cargo(cargo, 7));
    assert.equal(receive_food(receiver, cargo), true);
    assert.equal(receiver.food, 9);
    assert.deepEqual(receiver.food_stores, { fish: 2, plant: 6, meat: 1 });
    assert.equal(sender.food + receiver.food, before_total, 'debit, cargo and credit conserve total food');
    assert.deepEqual(cargo, { amount: 7, food_stores: { plant: 6, meat: 1 } },
        'delivery does not mutate a cargo snapshot');
});

test('typed food packing and receipt fail atomically on shortage, invalid cargo, or capacity', () => {
    const sender = kingdom(4, { meat: 4 }), before_sender = structuredClone(sender);
    assert.equal(pack_food(sender, 5), null);
    assert.deepEqual(sender, before_sender);
    const cargo = { amount: 3, food_stores: { plant: 3 } };
    assert.equal(valid_food_cargo(cargo, 3), true);
    assert.equal(valid_food_cargo({ amount: 3, food_stores: { plant: 2 } }), false);
    assert.equal(valid_food_cargo({ amount: 3, food_stores: { mystery: 3 } }), false);
    const full = kingdom(MAX_FOOD_STORES - 2, { plant: MAX_FOOD_STORES - 2 });
    const before_full = structuredClone(full);
    assert.equal(receive_food(full, cargo), false);
    assert.deepEqual(full, before_full, 'capacity rejection cannot partially credit stores');
    const open = kingdom(4, { plant: 4 });
    assert.equal(receive_food(open, cargo), true);
    assert.equal(open.food, 7);
});

test('the three Phase 1 diets use strict sources; other IDs are rejected', () => {
    const cases = [
        ['herbivore', 'plant', 'meat'], ['carnivore', 'fish', 'plant'],
        ['omnivore', 'insects', 'blood']
    ];
    for (const [diet_id, allowed, forbidden] of cases) {
        const stores = kingdom(12, { [allowed]: 5, [forbidden]: 7 });
        assert.equal(diet_food_available(stores, unit(diet_id)), 5, diet_id);
    }
    assert.equal(diet_food_available(kingdom(5, { kin_human: 5 }), unit('cannibalism')), 0);
    assert.equal(CANONICAL_RACES.length, 11);
    assert.ok(CANONICAL_RACES.every(race => ALL_FOOD_SOURCES.includes(`kin_${race}`)));
});

test('meals are all-or-nothing and safe omnivores still eat generic legacy plant food', () => {
    const stores = kingdom(10, { fruit: 4, meat: 6 });
    const hungry_specialist = unit('herbivore');
    assert.equal(consume_food(stores, hungry_specialist, 5), false);
    assert.equal(stores.food, 10); assert.deepEqual(stores.food_stores, { fruit: 4, meat: 6 });
    assert.equal(consume_food(stores, hungry_specialist, 4), true);
    assert.equal(stores.food, 6); assert.deepEqual(stores.food_stores, { meat: 6 });
    const legacy = kingdom(8, undefined);
    assert.equal(consume_food(legacy, unit('omnivore'), 3), true);
    assert.equal(legacy.food, 5); assert.deepEqual(legacy.food_stores, { plant: 5 });
    assert.equal(consume_food(kingdom(5, { plant: 5 }), unit('carnivore'), 1), false);
});

test('availability is read-only and projects unreconciled generic changes on a copy', () => {
    const stores = kingdom(7, { fruit: 5, meat: 2 });
    stores.food += 3;
    const before = structuredClone(stores);
    assert.equal(diet_food_available(stores, unit('herbivore')), 8);
    assert.deepEqual(stores, before, 'the read-only projection must not reconcile the original');
    stores.food -= 4;
    const after_delta = structuredClone(stores);
    assert.equal(diet_food_available(stores, unit('herbivore')), 4);
    assert.deepEqual(stores, after_delta, 'a negative generic delta is also projected without mutation');
});

test('malformed diets and food ledgers fail validation while stale totals remain reconcilable', () => {
    assert.equal(valid_food_stores(kingdom(9, undefined)), true, 'legacy ledgers are optional');
    assert.equal(valid_food_stores(kingdom(9, { fruit: 2 })), true, 'generic deltas may leave a stale sum');
    for (const stores of [null, [], { lava: 1 }, { plant: NaN }, { plant: -1 },
        { plant: MAX_FOOD_STORES + 1 }, { plant: MAX_FOOD_STORES, fruit: 1 }]) {
        assert.equal(valid_food_stores(kingdom(9, stores)), false);
    }
    assert.equal(valid_food_stores(kingdom(NaN, {})), false);
    const repaired = kingdom(NaN, { fruit: 5, mystery: 100 });
    assert.equal(reconcile_food(repaired), 0);
    assert.deepEqual(repaired.food_stores, {});
    assert.equal(repaired.food, 0);
});
