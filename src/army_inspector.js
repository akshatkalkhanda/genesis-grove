import { creature_stats } from './creatures.js';

// Reconstruct transient plans on load, including when the loaded world stays paused.
// This uses the simulation planner and does not add orders to the saved schema.
export function rebuild_armies(world) {
    const enemies = new Map();
    for (const relation of world.relations.filter(relation => relation.status === 'war')) {
        for (const [from, to] of [[relation.a, relation.b], [relation.b, relation.a]]) {
            if (!enemies.has(from)) enemies.set(from, new Set());
            enemies.get(from).add(to);
        }
    }
    world.plan_armies(enemies);
}

// Match plan_armies membership. Armies are home garrisons, not saved entities.
export function army_members(world, army) {
    return world.people.filter(person => person.role === 'soldier' && person.health > 0
        && person.village_id === army.kingdom_id
        && (person.home_id || person.village_id) === army.home_id
        && !person.voyage_id && !person.prisoner_of && !person.recovering
        && !world.machines.some(machine => machine.crew_id === person.id));
}

export function army_visible(army, layer, kingdom_id, selected) {
    return army.count > 0 && (army.target_id || army.kingdom_id === kingdom_id
        || layer === 'armies' || (selected?.home_id === army.home_id
            && selected?.kingdom_id === army.kingdom_id));
}

// Badges use fixed screen pixels, independent of map zoom.
export function army_badge_hit(army, point, origin, scale) {
    const x = origin.x + army.x * 6 * scale, y = origin.y + army.y * 6 * scale;
    return point.x >= x - 16 && point.x <= x + 19
        && point.y >= y - 31 && point.y <= y - 5;
}

export function army_summary(world, selection) {
    const army = world.armies.find(group => group.home_id === selection.id
        && group.kingdom_id === selection.kingdom_id);
    const kingdom = world.villages.find(site => site.id === army?.kingdom_id && site.alive);
    if (!army || !kingdom) return null;
    const members = army_members(world, army);
    if (!members.length) return null;
    const home = [...world.villages, ...world.colonies].find(site => site.id === army.home_id);
    const target = [...world.villages.filter(site => site.alive), ...world.colonies]
        .find(site => site.id === army.target_id && (site.kingdom_id || site.id) !== kingdom.id
            && world.relations.some(relation => relation.status === 'war'
                && ((relation.a === kingdom.id && relation.b === (site.kingdom_id || site.id))
                    || (relation.b === kingdom.id && relation.a === (site.kingdom_id || site.id)))));
    const tally = key => [...members.reduce((counts, person) => {
        const value = key(person); counts.set(value, (counts.get(value) || 0) + 1); return counts;
    }, new Map())].sort((a, b) => b[1] - a[1]);
    const strength = members.reduce((sum, person) => sum
        + creature_stats(person, world.year_length).strength, 0);
    return { army, kingdom, home, target, members, strength,
        activity: tally(person => person.task || 'Awaiting activity'),
        weapons: tally(person => person.weapon_level || 0),
        armor: tally(person => person.armor_level || 0) };
}
