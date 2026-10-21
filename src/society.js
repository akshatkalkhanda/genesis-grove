import { initialize_creature, TRAITS } from './creatures.js';

export const CULTURAL_VALUES = ['knowledge', 'craft', 'kinship', 'valor'];
const CULTURE_NAMES = ['Star Readers', 'River Artisans', 'Hearth Keepers', 'Dawn Guardians'];
export const MAX_RELATIONSHIPS = 8;

export function initialize_culture(kingdom) {
    const index = kingdom.id % CULTURAL_VALUES.length;
    kingdom.culture ??= { name: CULTURE_NAMES[index], value: CULTURAL_VALUES[index] };
    return kingdom.culture;
}

export function initialize_society_person(person, kingdom) {
    initialize_creature(person);
    person.family_id ??= person.parents?.[0]?.id || person.id;
    person.family_name ??= person.name.split(' ').slice(1).join(' ') || 'Grove';
    person.culture_id ??= kingdom?.id || person.village_id;
    person.partner_id ??= null;
    person.relationships ??= [];
    person.children_count ??= 0;
    return person;
}

export function ruler_personality(ruler) {
    return ({ curious: 'Scholar', industrious: 'Builder', careful: 'Diplomat',
        brave: 'Conqueror', hardy: 'Guardian' })[ruler?.trait] || 'Steward';
}

export function society_modifiers(kingdom, ruler) {
    const value = initialize_culture(kingdom).value;
    const personality = ruler_personality(ruler);
    return {
        personality,
        research: (value === 'knowledge' ? 1.15 : 1) * (personality === 'Scholar' ? 1.15 : 1),
        production: (value === 'craft' ? 1.12 : 1) * (personality === 'Builder' ? 1.12 : 1),
        training: (value === 'valor' ? 1.15 : 1) * (personality === 'Guardian' ? 1.15 : 1),
        healing: value === 'kinship' ? 1.2 : 1,
        war_bias: (value === 'valor' ? 0.08 : 0) + (personality === 'Conqueror' ? 0.18
            : personality === 'Diplomat' ? -0.25 : 0)
    };
}

function related(a, b) {
    if (a.family_id === b.family_id) return true;
    const parents = new Set((a.parents || []).map(p => p.id));
    return parents.has(b.id) || (b.parents || []).some(p => p.id === a.id || parents.has(p.id));
}

function available(person, year_length) {
    const years = person.age / year_length;
    return person.health > 0 && !person.prisoner_of && !person.voyage_id
        && years >= 18 && years <= 70;
}

function remember(person, other, amount) {
    let record = person.relationships.find(r => r.id === other.id);
    if (!record) {
        if (person.relationships.length >= MAX_RELATIONSHIPS) {
            const candidates = person.relationships.filter(r => r.id !== person.partner_id)
                .sort((a, b) => a.affinity - b.affinity || a.id - b.id);
            if (!candidates.length) return;
            person.relationships.splice(person.relationships.indexOf(candidates[0]), 1);
        }
        record = { id: other.id, name: other.name, affinity: 0 };
        person.relationships.push(record);
    }
    record.affinity = Math.min(100, record.affinity + amount);
}

// Called by daily activities when two citizens actually spend time together.
export function socialize(a, b, amount = 5) {
    if (!a || !b || a.id === b.id || a.health <= 0 || b.health <= 0) return;
    initialize_society_person(a);
    initialize_society_person(b);
    remember(a, b, Math.max(0, Math.min(10, amount)));
    remember(b, a, Math.max(0, Math.min(10, amount)));
}

export function advance_society(world) {
    if (world.villages.every(v => v.social_year === world.year)) return;
    const people_by_id = new Map(world.people.map(p => [p.id, p]));
    for (const kingdom of world.villages) {
        initialize_culture(kingdom);
        if (kingdom.social_year === world.year) continue;
        kingdom.social_year = world.year;
        const citizens = world.people.filter(p => p.village_id === kingdom.id && p.health > 0);
        for (const p of citizens) initialize_society_person(p, kingdom);
        for (const p of citizens) {
            const partner = people_by_id.get(p.partner_id);
            if (!partner || partner.health <= 0 || partner.partner_id !== p.id) p.partner_id = null;
            if (!available(p, world.year_length)) continue;
            const neighbours = citizens.filter(q => q.id !== p.id && available(q, world.year_length)
                && q.home_id === p.home_id && Math.hypot(p.x - q.x, p.y - q.y) <= 8)
                .sort((a, b) => Math.hypot(p.x - a.x, p.y - a.y)
                    - Math.hypot(p.x - b.x, p.y - b.y) || a.id - b.id).slice(0, 3);
            for (const neighbour of neighbours) socialize(p, neighbour, 5);
            if (p.partner_id) continue;
            const candidate = neighbours.find(q => !q.partner_id && !related(p, q)
                && p.relationships.some(r => r.id === q.id && r.affinity >= 10));
            if (!candidate) continue;
            p.partner_id = candidate.id;
            candidate.partner_id = p.id;
            world.log?.(`${p.name} and ${candidate.name} form a family.`, 'village', p);
        }
    }
}

export function select_parents(world, kingdom_id, home_id) {
    const by_id = new Map(world.people.map(p => [p.id, p]));
    const candidates = world.people.filter(p => p.village_id === kingdom_id
        && p.home_id === home_id && available(p, world.year_length)
        && p.partner_id && world.year - (p.last_child_year ?? -100) >= 2)
        .sort((a, b) => (a.children_count || 0) - (b.children_count || 0) || a.id - b.id);
    for (const p of candidates) {
        const q = by_id.get(p.partner_id);
        if (q && q.partner_id === p.id && q.village_id === kingdom_id && q.home_id === home_id
            && available(q, world.year_length) && !related(p, q)
            && world.year - (q.last_child_year ?? -100) >= 2) return [p, q];
    }
    return null;
}

export function initialize_child(child, parents, kingdom, random = Math.random, year = 1) {
    initialize_society_person(child, kingdom);
    for (const parent of parents) initialize_society_person(parent, kingdom);
    const [first, second] = parents;
    child.parents = parents.map(p => ({ id: p.id, name: p.name }));
    child.family_id = first.family_id;
    child.family_name = first.family_name;
    child.culture_id = first.culture_id;
    child.name = `${child.name.split(' ')[0]} ${child.family_name}`.slice(0, 40);
    child.trait = random() < 0.9 ? (random() < 0.5 ? first.trait : second.trait)
        : TRAITS[Math.floor(random() * TRAITS.length)];
    child.heritage_trait = second.trait;
    for (const parent of parents) {
        parent.children_count = Math.min(10000, (parent.children_count || 0) + 1);
        parent.last_child_year = year;
        socialize(parent, child, 10);
    }
    return child;
}

const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
export function validate_culture(kingdom) {
    return (kingdom.culture === undefined || (kingdom.culture
        && text(kingdom.culture.name, 40) && CULTURAL_VALUES.includes(kingdom.culture.value)))
        && (kingdom.social_year === undefined || integer(kingdom.social_year, 1, 1e9));
}

export function validate_society_person(p, next_id) {
    const valid_id = id => integer(id, 1, next_id - 1);
    return (p.family_id === undefined || valid_id(p.family_id))
        && (p.family_name === undefined || text(p.family_name, 40))
        && (p.culture_id === undefined || valid_id(p.culture_id))
        && (p.partner_id == null || (valid_id(p.partner_id) && p.partner_id !== p.id))
        && (p.children_count === undefined || integer(p.children_count, 0, 10000))
        && (p.last_child_year === undefined || integer(p.last_child_year, 1, 1e9))
        && (p.heritage_trait === undefined || TRAITS.includes(p.heritage_trait))
        && (p.relationships === undefined || (Array.isArray(p.relationships)
            && p.relationships.length <= MAX_RELATIONSHIPS
            && new Set(p.relationships.map(r => r?.id)).size === p.relationships.length
            && p.relationships.every(r => r && valid_id(r.id) && r.id !== p.id
                && text(r.name, 40) && Number.isFinite(r.affinity)
                && r.affinity >= 0 && r.affinity <= 100)));
}
