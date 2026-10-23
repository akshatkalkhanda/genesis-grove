import { creature_stats } from './creatures.js';

import { refresh_armies, ARMY_REASONS, army_route_issue } from './army_orders.js';
import { siege_summary } from './sieges.js';

// Rebuild markers from saved orders only, including while paused.
export function rebuild_armies(world) {
    refresh_armies(world);
}

// Match the planner's current eligible membership.
export function army_members(world, army) {
    return world.people.filter(person => person.role === 'soldier' && person.health > 0
        && person.village_id === army.kingdom_id
        && (person.home_id || person.village_id) === army.home_id
        && !person.voyage_id && !person.prisoner_of && !person.recovering
        && !world.machines.some(machine => machine.crew_id === person.id));
}

export function army_visible(army, layer, kingdom_id, selected) {
    return army.count > 0 && (army.target_id || army.state === 'retreat' || army.kingdom_id === kingdom_id
        || layer === 'armies' || (selected?.home_id === army.home_id
            && selected?.kingdom_id === army.kingdom_id));
}

// Badges use fixed screen pixels, independent of map zoom.
export function army_badge_hit(army, point, origin, scale) {
    const x = origin.x + army.x * 6 * scale, y = origin.y + army.y * 6 * scale;
    return point.x >= x - 16 && point.x <= x + 19
        && point.y >= y - 31 && point.y <= y - 5;
}

// A saved intent may be stale while paused; drawing/inspection must not claim it is a live enemy.
export function army_target(world, army) {
    return [...world.villages.filter(site => site.alive), ...world.colonies]
        .find(site => site.id === army.target_id && (site.kingdom_id || site.id) !== army.kingdom_id
            && world.relations.some(relation => relation.status === 'war'
                && ((relation.a === army.kingdom_id && relation.b === (site.kingdom_id || site.id))
                    || (relation.b === army.kingdom_id && relation.a === (site.kingdom_id || site.id)))));
}

// Only actual pressure, attacking forces, or the selected target get a map marker.
// Summaries validate saved pressure against current diplomacy without changing it.
export function siege_markers(world, selected) {
    const targets = new Set();
    let selected_target = null;
    for (const army of world.armies) {
        const target = army_target(world, army);
        if (!target) continue;
        const is_selected = army.home_id === selected?.home_id
            && army.kingdom_id === selected?.kingdom_id;
        if (is_selected) selected_target = target.id;
        if (is_selected || army.state === 'attack') targets.add(target.id);
    }
    return [...world.villages.filter(site => site.alive), ...world.colonies]
        .filter(site => site.siege > 0 || targets.has(site.id))
        .map(site => ({ site, siege: siege_summary(world, site), selected: site.id === selected_target }))
        .filter(marker => marker.selected || marker.siege.progress > 0
            || marker.siege.attackers >= 2)
        .sort((a, b) => Number(b.selected) - Number(a.selected)
            || b.siege.percent - a.siege.percent || a.site.id - b.site.id);
}

// Fixed screen dimensions and collision checks keep zoomed-out siege labels restrained.
export function siege_badge_layout(marker, camera, reserved = []) {
    const x = camera.origin.x + marker.site.x * 6 * camera.scale;
    const y = camera.origin.y + marker.site.y * 6 * camera.scale;
    const width = 100, height = 28;
    for (const [dx, dy] of [[16, -14], [-116, -14], [-50, 20], [-50, -60]]) {
        const box = { x: x + dx, y: y + dy, width, height };
        if (box.x < 8 || box.x + width > camera.width - 8
            || box.y < 70 || box.y + height > camera.height - 70) continue;
        if (reserved.some(other => box.x < other.x + other.width + 4
            && box.x + width + 4 > other.x && box.y < other.y + other.height + 4
            && box.y + height + 4 > other.y)) continue;
        return box;
    }
    return null;
}

export function army_summary(world, selection) {
    const army = world.armies.find(group => group.home_id === selection.id
        && group.kingdom_id === selection.kingdom_id);
    const kingdom = world.villages.find(site => site.id === army?.kingdom_id && site.alive);
    if (!army || !kingdom) return null;
    const members = army_members(world, army);
    if (!members.length) return null;
    const home = [...world.villages, ...world.colonies].find(site => site.id === army.home_id);
    const target = army_target(world, army);
    const tally = key => [...members.reduce((counts, person) => {
        const value = key(person); counts.set(value, (counts.get(value) || 0) + 1); return counts;
    }, new Map())].sort((a, b) => b[1] - a[1]);
    const strength = members.reduce((sum, person) => sum
        + creature_stats(person, world.year_length).strength, 0);
    const pending = army.target_id && !target;
    const blocked_members = [];
    const route_causes = new Set();
    const route_issues = new Map();
    let blocked_count = 0;
    if (army.reason === 'home_blocked' && home) {
        for (const person of members) {
            const key = `${Math.floor(person.x)},${Math.floor(person.y)}`;
            if (!route_issues.has(key)) route_issues.set(key, army_route_issue(world, person, home));
            const reason = route_issues.get(key);
            if (!reason) continue;
            blocked_count++;
            route_causes.add(reason);
            if (blocked_members.length < 3) blocked_members.push({
                id: person.id, name: person.name || `Citizen #${person.id}`, reason
            });
        }
    }
    const blocked_names = blocked_members.map(person => person.name).join(', ');
    const route_caveats = [];
    if (route_causes.has('different_landmass')) route_caveats.push('some are on a different landmass');
    if (route_causes.has('unwalkable_endpoint')) route_caveats.push('some member or home locations are not walkable');
    if (route_causes.has('bounded_search_no_route')) route_caveats.push('an unsuccessful bounded search may mean a blocked route or search limit');
    const route_reason = blocked_count ? `${blocked_count} garrison member${blocked_count === 1 ? '' : 's'} cannot confirm a route home${blocked_names ? `: ${blocked_names}` : ''}${route_caveats.length ? `; ${route_caveats.join('; ')}.` : '.'}`
        : ARMY_REASONS[army.reason];
    return { army, kingdom, home, target, members, strength,
        siege: target ? siege_summary(world, target) : null,
        order_label: `${army.state[0].toUpperCase()}${army.state.slice(1)}${pending ? ' · awaiting review' : ''}`,
        order_reason: pending ? 'The former target is no longer an enemy town. The saved order will be reviewed when time runs.'
            : army.reason === 'home_blocked' ? route_reason : ARMY_REASONS[army.reason],
        blocked_members, blocked_count,
        activity: tally(person => person.task || 'Awaiting activity'),
        weapons: tally(person => person.weapon_level || 0),
        armor: tally(person => person.armor_level || 0) };
}
