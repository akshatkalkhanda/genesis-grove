import { creature_stats } from './creatures.js';
import { find_path } from './pathfinding.js';

export const ARMY_REASONS = Object.freeze({
    awaiting_plan: 'Home guard; autonomous planning begins when time runs.',
    peace: 'No war; returning to guard home or train.',
    home_threat: 'Enemy soldiers threaten home; defending the settlement.',
    low_health: 'The group is wounded; returning home to recover.',
    low_food: 'Shared kingdom food is low; holding near home.',
    too_small: 'At least two active soldiers are needed for a campaign.',
    stronger_enemy: 'Insufficient equipped-strength margin for this campaign; holding home.',
    unreachable: 'No enemy town has a route within the land planning budget.',
    route_blocked: 'The former target route is blocked; returning to guard home.',
    home_blocked: 'Home has no usable land route; holding current ground.',
    target_changed: 'The former target changed ownership or was lost; guarding home.',
    assemble: 'Gathering dispersed members at home before the campaign.',
    campaign: 'Keeping the selected reachable enemy town as the campaign target.',
    attack: 'Members are in siege range; pressing the selected town.'
});
export const ARMY_STATES = Object.freeze(['assemble', 'defend', 'march', 'attack', 'retreat']);
export const army_identity = (kingdom_id, home_id) => `${kingdom_id}:${home_id}`;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const owner = site => site.kingdom_id || site.id;

export function army_groups(world) {
    const crews = new Set(world.machines.map(machine => machine.crew_id));
    const homes = new Map([...world.villages.filter(site => site.alive), ...world.colonies]
        .map(site => [site.id, site]));
    const groups = new Map();
    for (const person of world.people) {
        const home_id = person.home_id || person.village_id, home = homes.get(home_id);
        if (person.role !== 'soldier' || person.health <= 0 || person.voyage_id
            || person.prisoner_of || person.recovering || crews.has(person.id)
            || !home || owner(home) !== person.village_id
            || !world.villages.some(site => site.id === person.village_id && site.alive)) continue;
        const id = army_identity(person.village_id, home_id);
        if (!groups.has(id)) groups.set(id, { id, kingdom_id: person.village_id, home_id, home, members: [] });
        groups.get(id).members.push(person);
    }
    return groups;
}

// Bounded, deterministic and transient. Rejected searches are not permission to walk directly.
export function army_reachable(world, from, to) {
    if (!world.walkable(from.x, from.y) || !world.walkable(to.x, to.y)) return false;
    if (world._army_masses_revision === world.navigation_revision
        && world._army_masses[world.index(from.x, from.y)] !== world._army_masses[world.index(to.x, to.y)]) return false;
    if (Math.floor(from.x) === Math.floor(to.x) && Math.floor(from.y) === Math.floor(to.y)) return true;
    const key = `${Math.floor(from.x)},${Math.floor(from.y)}>${Math.floor(to.x)},${Math.floor(to.y)}:${world.navigation_revision}`;
    world._army_routes ||= new Map();
    if (!world._army_routes.has(key)) {
        if (world._army_routes.size >= 4096) world._army_routes.clear();
        world._army_routes.set(key, find_path(world, from, to).length > 0);
    }
    return world._army_routes.get(key);
}

// Projection only: selection/load must neither issue orders nor consume time/randomness.
export function refresh_armies(world) {
    const saved = new Map(world.army_orders.map(order => [order.id, order]));
    const sites = [...world.villages.filter(site => site.alive), ...world.colonies];
    world.armies = [...army_groups(world).values()].map(group => {
        const order = saved.get(group.id) || { id: group.id, kingdom_id: group.kingdom_id,
            home_id: group.home_id, state: 'defend', reason: 'awaiting_plan', target_id: null,
            issued_tick: world.tick };
        const target = sites.find(site => site.id === order.target_id);
        return { ...order, x: group.members.reduce((sum, person) => sum + person.x, 0) / group.members.length,
            y: group.members.reduce((sum, person) => sum + person.y, 0) / group.members.length,
            count: group.members.length, target_name: target?.name || null,
            target_x: target?.x ?? null, target_y: target?.y ?? null };
    });
}

export function prune_army_orders(world) {
    const groups = army_groups(world);
    const sites = new Set([...world.villages, ...world.colonies].map(site => site.id));
    world.army_orders = world.army_orders.filter(order => groups.has(order.id)).map(order =>
        order.target_id && !sites.has(order.target_id) ? { ...order, target_id: null,
            state: 'defend', reason: 'target_changed', issued_tick: world.tick } : order);
}

function strength(world, people) {
    return people.reduce((sum, person) => {
        const stats = creature_stats(person, world.year_length);
        return sum + stats.strength * Math.max(0, person.health) / stats.max_health
            * (1 + (person.weapon_level || 0) * 0.28) * (1 + (person.armor_level || 0) * 0.1);
    }, 0);
}

// Reject separated members immediately. Individual movement still checks each bounded route.
function campaign_route(world, members, target) {
    const mass = world._army_masses[world.index(target.x, target.y)];
    return mass >= 0 && members.every(person => world._army_masses[world.index(person.x, person.y)] === mass)
        && army_reachable(world, members[0], target);
}

export function plan_armies(world, war_targets) {
    const previous = new Map(world.army_orders.map(order => [order.id, order]));
    const sites = [...world.villages.filter(site => site.alive), ...world.colonies];
    const active = [...army_groups(world).values()];
    const orders = [];
    for (const group of active) {
        const { id, kingdom_id, home_id, home, members } = group;
        const old = previous.get(id), enemies = war_targets.get(kingdom_id);
        const kingdom = world.villages.find(site => site.id === kingdom_id);
        const at_home = members.every(person => distance(person, home) <= 8);
        const anchor = members[0];
        const health = members.reduce((sum, person) => sum
            + person.health / creature_stats(person, world.year_length).max_health, 0) / members.length;
        const recovering = old?.reason === 'low_health' && health < 0.65;
        const short_food = kingdom.food < Math.max(10, members.length * 3.4)
            || (old?.reason === 'low_food' && kingdom.food < Math.max(14, members.length * 5));
        const hold = reason => ({ state: at_home ? 'defend' : 'retreat', reason, target_id: null });
        let next;
        if (health < 0.45 || recovering) next = hold('low_health');
        else if (short_food) next = hold('low_food');
        else if (!enemies?.size) next = { state: 'defend', reason: 'peace', target_id: null };
        else if (world.people.some(person => person.health > 0 && !person.prisoner_of && !person.voyage_id
            && person.role === 'soldier' && enemies.has(person.village_id) && distance(person, home) < 12
            && army_reachable(world, home, person))) {
            next = { state: 'defend', reason: 'home_threat', target_id: null };
        } else if (members.length < 2) next = hold('too_small');
        else {
            let target = sites.find(site => site.id === old?.target_id && enemies.has(owner(site)));
            if (old?.target_id && !target) next = hold('target_changed');
            else if (target && !campaign_route(world, members, target)) next = hold('route_blocked');
            else {
                const power = strength(world, members);
                const defend_power = site => strength(world, world.people.filter(person => person.health > 0
                    && person.role === 'soldier' && !person.prisoner_of && !person.voyage_id
                    && person.village_id === owner(site) && distance(person, site) <= 12));
                // Examine at most eight nearest sites. Hold a chosen target until an actual invalidation.
                const candidates = target ? [target] : sites.filter(site => enemies.has(owner(site)))
                    .sort((a, b) => distance(anchor, a) - distance(anchor, b) || a.id - b.id).slice(0, 8);
                let reachable = false;
                target = candidates.find(site => {
                    if (!campaign_route(world, members, site)) return false;
                    reachable = true;
                    return power >= defend_power(site) * (old?.target_id === site.id ? 0.8 : 1.1);
                });
                if (!target) next = hold(reachable ? 'stronger_enemy' : 'unreachable');
                else if ((old?.state === 'assemble' && !at_home)
                    || (!old?.target_id && members.some(person => distance(person, anchor) > 8))) {
                    next = { state: 'assemble', reason: 'assemble', target_id: target.id };
                } else {
                    const attacking = members.some(person => distance(person, target) <= 6);
                    next = { state: attacking ? 'attack' : 'march', reason: attacking ? 'attack' : 'campaign', target_id: target.id };
                }
            }
        }
        if (!['march', 'attack'].includes(next.state) && !members.every(person => army_reachable(world, person, home))) {
            next = { state: 'defend', reason: 'home_blocked', target_id: null };
        }
        const unchanged = old && old.state === next.state && old.reason === next.reason && old.target_id === next.target_id;
        orders.push({ id, kingdom_id, home_id, ...next, issued_tick: unchanged ? old.issued_tick : world.tick });
    }
    world.army_orders = orders;
    refresh_armies(world);
    return new Map(world.armies.map(army => [army.id, army]));
}

export function valid_army_orders(data) {
    if (data.army_orders === undefined) return true;
    if (!Array.isArray(data.army_orders) || data.army_orders.length > 360) return false;
    const keys = new Set();
    const sites = new Map([...data.villages, ...(data.colonies || [])].map(site => [site.id, site]));
    return data.army_orders.every(order => {
        if (!order || typeof order !== 'object') return false;
        const home = sites.get(order.home_id);
        const reason_state = order.reason === 'campaign' ? order.state === 'march'
            : order.reason === 'attack' ? order.state === 'attack'
                : order.reason === 'assemble' ? order.state === 'assemble'
                    : ['peace', 'home_threat', 'home_blocked', 'awaiting_plan'].includes(order.reason)
                        ? order.state === 'defend' : ['defend', 'retreat'].includes(order.state);
        const valid = Object.keys(order).length === 7
            && Object.keys(order).every(key => ['id', 'kingdom_id', 'home_id', 'state', 'reason', 'target_id', 'issued_tick'].includes(key))
            && reason_state && order.id === army_identity(order.kingdom_id, order.home_id) && !keys.has(order.id)
            && data.villages.some(site => site.id === order.kingdom_id && site.alive)
            && home && home.alive !== false && owner(home) === order.kingdom_id
            && ARMY_STATES.includes(order.state) && Object.hasOwn(ARMY_REASONS, order.reason)
            && Number.isInteger(order.issued_tick) && order.issued_tick >= 0 && order.issued_tick <= data.tick
            && (order.target_id === null || (Number.isInteger(order.target_id)
                && sites.has(order.target_id)))
            && (['assemble', 'march', 'attack'].includes(order.state) ? order.target_id !== null : order.target_id === null);
        keys.add(order.id);
        return valid;
    });
}
