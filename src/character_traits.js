// Additional character traits are independent of the five legacy personality traits.
export const MAX_CHARACTER_TRAITS = 12;
export const TRAIT_BALANCE = Object.freeze({ rare_thief_period: 31 });
const aliases = Object.freeze({ long_liver: 'long_lived' });
const canonical = id => aliases[id] || id;
const definition = (id, label, group, description, effects, conflicts = [], probability = 0.3,
    safe_auto = true) => Object.freeze({ id, label, group, category: group.toLowerCase(),
    description, effects: Object.freeze(effects), conflicts: Object.freeze(conflicts),
    inheritance_probability: probability, safe_auto });

// Inheritance probabilities are configuration for the later inheritance phase;
// current primary-trait/heritage inheritance continues in society.js.
export const TRAIT_CATALOG = Object.freeze([
    definition('lucky', 'Lucky', 'Luck',
        'Positive opportunity chances multiply by 1.2, capped at 100%; outcomes use seeded world rolls.',
        { luck: 1.2 }, ['unlucky'], 0.25),
    definition('unlucky', 'Unlucky', 'Luck',
        'Positive opportunity chances multiply by 0.8; outcomes use seeded world rolls.',
        { luck: 0.8 }, ['lucky'], 0.25),
    definition('strong', 'Strong', 'Body', 'Adds 4 strength.', { strength: 4 }, ['weak'], 0.4),
    definition('weak', 'Weak', 'Body', 'Subtracts 4 strength, with a minimum of 1.',
        { strength: -4 }, ['strong'], 0.4),
    definition('fast', 'Fast', 'Body', 'Moves 25% faster on otherwise valid routes.',
        { movement: 1.25 }, ['slow'], 0.4),
    definition('slow', 'Slow', 'Body', 'Moves 20% slower.', { movement: 0.8 }, ['fast'], 0.4),
    definition('genius', 'Genius', 'Mind', 'Adds 5 intelligence and gains 15% more earned experience.',
        { intelligence: 5, learning: 1.15 }, ['stupid'], 0.25),
    definition('stupid', 'Stupid', 'Mind', 'Subtracts 4 intelligence and gains 20% less earned experience.',
        { intelligence: -4, learning: 0.8 }, ['genius'], 0.25),
    definition('long_lived', 'Long-lived', 'Body', 'Age-related decline starts 30% later.',
        { lifespan: 1.3 }, [], 0.35),
    definition('regeneration', 'Regeneration', 'Special',
        'While nourished, recovers 0.5 health per simulation second, up to current maximum health.',
        { regen: 0.5 }, [], 0.1, false),
    definition('thief', 'Thief', 'Social',
        'Can pilfer up to 1 carried food or timber during a nearby adult social encounter; the victim loses 5 affinity.',
        {}, ['honest'], 0, false),
    definition('honest', 'Honest', 'Social',
        'Others gain 1 extra affinity per social interaction. Cannot coexist with Thief.',
        { social_in: 1 }, ['thief'], 0.25),
    definition('peaceful', 'Peaceful', 'Temperament',
        'Avoids initiating fights; can still defend against nearby threats.',
        { aggression: 'peaceful' }, ['aggressive'], 0.3),
    definition('aggressive', 'Aggressive', 'Temperament',
        'Initiates combat more readily when an eligible hostile target is available.',
        { aggression: 'aggressive' }, ['peaceful'], 0.3, false)
]);
const by_id = new Map(TRAIT_CATALOG.map(trait => [trait.id, trait]));
const safe_traits = TRAIT_CATALOG.filter(trait => trait.safe_auto);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ADDITIVE_FIELDS = new Set(['strength', 'intelligence', 'max_health', 'regen', 'social_in']);

export function has_trait(unit, id) {
    return Array.isArray(unit?.trait_ids)
        && unit.trait_ids.some(value => canonical(value) === canonical(id));
}

export function valid_character_traits(unit) {
    if (!unit || typeof unit !== 'object') return false;
    if (unit.trait_thefts !== undefined && (!Number.isInteger(unit.trait_thefts)
        || unit.trait_thefts < 0 || unit.trait_thefts > 1e6)) return false;
    if (unit.trait_ids === undefined) return true; // Legacy additional traits are empty.
    if (!Array.isArray(unit.trait_ids) || unit.trait_ids.length > MAX_CHARACTER_TRAITS
        || unit.trait_ids.some(id => typeof id !== 'string' || !by_id.has(canonical(id)))) return false;
    const ids = unit.trait_ids.map(canonical), unique = new Set(ids);
    return unique.size === ids.length
        && ids.every(id => by_id.get(id).conflicts.every(conflict => !unique.has(conflict)));
}

// True means accepted, including a valid no-op. Rejections never alter the unit.
export function apply_trait(unit, id, enabled = true) {
    const key = canonical(id), trait = by_id.get(key);
    if (!trait || typeof enabled !== 'boolean' || !valid_character_traits(unit)) return false;
    let ids = (unit.trait_ids || []).map(canonical);
    if (enabled) {
        ids = ids.filter(existing => !trait.conflicts.includes(existing)
            && !by_id.get(existing).conflicts.includes(key));
        if (!ids.includes(key)) ids.push(key);
        if (ids.length > MAX_CHARACTER_TRAITS) return false;
    } else ids = ids.filter(existing => existing !== key);
    unit.trait_ids = ids;
    return true;
}

export function initialize_traits(unit, { new_person = false } = {}) {
    if (unit.trait_ids === undefined) unit.trait_ids = [];
    if (!valid_character_traits(unit)) return unit; // Imports must reject, not silently repair.
    unit.trait_ids = unit.trait_ids.map(canonical);
    if (new_person && !unit.species && unit.trait_ids.length === 0) {
        // Stable common defaults use no world RNG, including during birth setup.
        const hash = Math.imul(Number.isInteger(unit.id) ? unit.id : 1, 0x45d9f3b) >>> 0;
        const desired = 1 + (hash >>> 8) % 2;
        for (let offset = 0; offset < safe_traits.length && unit.trait_ids.length < desired; offset++) {
            apply_trait(unit, safe_traits[(hash + offset * 7) % safe_traits.length].id);
        }
    }
    if (new_person && !unit.species && !has_trait(unit, 'honest')
        && ((Math.imul(unit.id || 1, 0x27d4eb2d) >>> 0) % TRAIT_BALANCE.rare_thief_period === 0)) apply_trait(unit, 'thief');
    return unit;
}

export function trait_modifiers(unit) {
    const result = { strength: 0, intelligence: 0, max_health: 0,
        movement: 1, vision: 1, meal: 1, fertility: 1, lifespan: 1, regen: 0,
        damage_out: 1, learning: 1, luck: 1, aggression: 'neutral', social_in: 0 };
    if (!Array.isArray(unit?.trait_ids) || !unit.trait_ids.length) return result;
    for (const id of new Set((Array.isArray(unit?.trait_ids) ? unit.trait_ids : []).map(canonical))) {
        for (const [key, value] of Object.entries(by_id.get(id)?.effects || {})) {
            if (key === 'aggression') result.aggression = value;
            else if (ADDITIVE_FIELDS.has(key)) result[key] += value;
            else result[key] *= value;
        }
    }
    for (const key of ['strength', 'intelligence']) result[key] = clamp(result[key], -20, 20);
    result.max_health = clamp(result.max_health, -100, 200);
    result.regen = clamp(result.regen, 0, 2);
    result.social_in = clamp(result.social_in, -3, 3);
    for (const key of ['movement', 'vision', 'meal', 'lifespan', 'damage_out', 'learning']) {
        result[key] = clamp(result[key], 0.25, 2);
    }
    result.fertility = clamp(result.fertility, 0, 2);
    result.luck = clamp(result.luck, 0.5, 1.5);
    return result;
}

export function trait_probability(unit, base) {
    return Number.isFinite(base) ? clamp(base * trait_modifiers(unit).luck, 0, 1) : 0;
}
