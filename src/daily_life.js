import { farm_operational, local_farms } from './settlement_land.js';
import { mining_site, mine_resource } from './mining.js';
import { harvest_tree, is_tree_site } from './forestry.js';
import { has_trait } from './character_traits.js';
import { find_path } from './pathfinding.js';
import { socialize, adjust_relationship } from './society.js';
// Civilian routines use simulation seconds, independent of the visual day/night clock.
const PHASES = ['travel', 'work', 'return', 'rest', 'social'];
const WOODED = new Set([4, 9, 12, 13, 15]);
const JOB_LABELS = { farmer: 'Tending crops', lumberjack: 'Cutting timber', miner: 'Mining',
    smith: 'Forging tools', builder: 'Maintaining buildings' };
const JOB_BUILDINGS = { farmer: ['farm'], smith: ['astral_forge', 'factory', 'armory', 'workshop'],
    builder: ['castle', 'windmill', 'watchtower', 'monument'] };
const WORK_BUILDINGS = new Set([...Object.values(JOB_BUILDINGS).flat(), 'school']);
const SITE_KINDS = new Set(['forest', 'forage', 'mine', 'home', ...WORK_BUILDINGS]);
const near = (person, point) => Math.hypot(person.x - point.x, person.y - point.y) < 1.25;
const point = (site, kind) => ({ x: site.x, y: site.y, kind });

export function initialize_daily_life(person) {
    person.daily_life ||= { phase: 'travel', energy: 75 + person.id % 25, timer: 0,
        site: null, cargo: { food: 0, wood: 0 }, delivered: 0, cycles: 0, partner_id: null };
    return person.daily_life;
}

function select_site(world, person, home, kingdom) {
    const mass = world._army_masses?.[world.index(person.x, person.y)];
    const reachable = site => world.walkable(site.x, site.y)
        && (mass === undefined || world._army_masses[world.index(site.x, site.y)] === mass);
    if (person.age / world.year_length < 18) {
        const school = person.age / world.year_length >= 6
            && kingdom.buildings?.find(b => b.type === 'school' && reachable(b));
        return school ? point(school, 'school') : point(home, 'home');
    }
    if (person.job === 'miner') return mining_site(world, person, home, kingdom) || point(home, 'home');
    if (person.job === 'farmer') {
        const fields = local_farms(world, kingdom, home).filter(reachable);
        if (fields.length) {
            const nearest = Math.hypot(fields[0].x - home.x, fields[0].y - home.y);
            const nearby = fields.filter(b => Math.hypot(b.x - home.x, b.y - home.y) <= nearest + 3);
            return point(nearby[person.id % nearby.length], 'farm');
        }
    }
    for (const type of (person.job === 'farmer' ? [] : JOB_BUILDINGS[person.job] || [])) {
        const sites = (kingdom.buildings || []).filter(site => site.type === type
            && reachable(site));
        sites.sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y)
            - Math.hypot(b.x - home.x, b.y - home.y));
        if (sites.length) return point(sites[person.id % sites.length], type);
    }
    // Search locally once per trip; stagger destinations so a town does not stack on one tile.
    let best = null, score = Infinity;
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const x = Math.floor(home.x) + dx, y = Math.floor(home.y) + dy;
        if (!reachable({ x, y }) || world.fire[world.index(x, y)] > 0) continue;
        const tile = world.tile(x, y);
        const match = person.job === 'lumberjack' ? is_tree_site(world, x, y)
            : person.job === 'miner' ? world.ores[world.index(x, y)] > 0 || tile === 5 || tile === 14
                : person.job === 'farmer' ? world.fertility[world.index(x, y)] > 0.2 : false;
        if (!match) continue;
        const distance = Math.hypot(dx, dy) + ((x * 7 + y * 13 + person.id * 3) % 9);
        if (distance < score) { best = { x: x + 0.5, y: y + 0.5,
            kind: person.job === 'lumberjack' ? 'forest' : person.job === 'miner' ? 'mine' : 'forage' }; score = distance; }
    }
    return best || point(home.houses?.[person.id % Math.max(1, home.houses.length)] || home, 'home');
}

export function advance_daily_life(world, person, home, kingdom, dt, max_health) {
    if (!home || !kingdom || person.role === 'soldier' || person.prisoner_of || person.voyage_id) return null;
    const state = initialize_daily_life(person);
    const child = person.age / world.year_length < 18;
    // Old saves may retain an adult work site after a creature's age is edited.
    if (child && state.site && !['school', 'home'].includes(state.site.kind)) {
        state.site = null; state.phase = 'travel'; state.timer = 0;
    }
    const house = home.houses?.[person.id % Math.max(1, home.houses.length)] || home;
    state.timer = Math.min(120, state.timer + dt);
    const vanished_building = state.site && WORK_BUILDINGS.has(state.site.kind)
        && !(kingdom.buildings || []).some(building => building.type === state.site.kind
            && building.x === state.site.x && building.y === state.site.y);
    const invalid_farm = state.site?.kind === 'farm' && !kingdom.buildings?.some(b => b.type === 'farm'
        && b.x === state.site.x && b.y === state.site.y && farm_operational(world, kingdom, b));
    const exhausted_mine = state.site?.kind === 'mine' && !mine_resource(world, state.site, kingdom.research_level || 0);
    const vanished_tree = state.site?.kind === 'forest' && !is_tree_site(world, state.site.x, state.site.y);
    if (state.site && (vanished_building || vanished_tree || invalid_farm || exhausted_mine || !world.walkable(state.site.x, state.site.y)
        || world.fire[world.index(state.site.x, state.site.y)] > 0)) {
        state.phase = 'return'; state.timer = 0; state.site = null;
    }
    if (state.phase === 'travel' || state.phase === 'work') {
        state.energy = Math.max(0, state.energy - dt * (state.phase === 'work' ? 1.1 : 0.5));
        state.site ||= select_site(world, person, home, kingdom);
        if (state.energy <= 20 || state.timer >= 35) { state.phase = 'return'; state.timer = 0; }
        else if (state.phase === 'travel' && near(person, state.site)) {
            state.phase = 'work'; state.timer = 0;
        } else if (state.phase === 'work' && state.timer >= 9) {
            state.phase = 'return'; state.timer = 0;
        }
    }
    if (state.phase === 'return' && near(person, house)) {
        kingdom.food += state.cargo.food; kingdom.wood += state.cargo.wood;
        state.delivered = Math.min(1e6, state.delivered + state.cargo.food + state.cargo.wood);
        state.cargo = { food: 0, wood: 0 }; state.cycles = Math.min(1e6, state.cycles + 1);
        state.phase = state.energy < 55 ? 'rest' : state.cycles % 3 === 0 ? 'social' : 'travel';
        state.site = null; state.timer = 0;
    }
    // A blocked route is retried from the current home rather than retaining a stale job forever.
    if (state.phase === 'return' && state.timer >= 60) {
        // Lost supplies are not credited remotely when a bridge or route disappears.
        state.cargo = { food: 0, wood: 0 }; state.site = null; state.timer = 0;
        state.phase = 'rest';
    }
    if (state.phase === 'rest') {
        state.energy = Math.min(100, state.energy + dt * 6);
        if (kingdom.food > 1 && !person.infection && near(person, house)) {
            person.health = Math.min(max_health, person.health + dt * 0.6);
        }
        if (state.energy >= 95) { state.phase = 'travel'; state.timer = 0; }
    }
    if (state.phase === 'social') {
        if (!state.partner_id) {
            const companion = world.people.find(other => other.id !== person.id
            && other.village_id === person.village_id && other.health > 0 && !other.voyage_id
            && !other.prisoner_of && Math.hypot(other.x - person.x, other.y - person.y) < 4);
            state.partner_id = companion?.id || null;

        }
        state.energy = Math.min(100, state.energy + dt * 2);
        if (state.timer >= 4 || !state.partner_id) {
            const companion = world.people.find(other => other.id === state.partner_id);
            if (companion && companion.health > 0 && !companion.prisoner_of && !companion.voyage_id
                && companion.village_id === person.village_id
                && Math.hypot(person.x - companion.x, person.y - companion.y) < 4) {
                socialize(person, companion, 2);
                attempt_theft(world, person, companion);
            }
            state.phase = 'travel'; state.timer = 0; state.partner_id = null;
        }
    }
    const task = state.phase === 'travel' ? child
        ? state.site?.kind === 'school' ? 'Going to school' : 'Returning home'
        : `Going to ${state.site?.kind || 'work'}`
        : state.phase === 'work' ? person.age / world.year_length < 18 ? state.site?.kind === 'school' ? 'Learning at school' : 'Learning and playing'
            : state.site?.kind === 'home' ? 'Helping at home' : JOB_LABELS[person.job] || 'Working'
            : state.phase === 'return' ? child ? 'Returning home' : 'Delivering supplies'
                : state.phase === 'rest' ? 'Resting at home' : 'Socializing';
    person.task = task;
    const target = state.phase === 'travel' ? state.site : state.phase === 'return' ? house : null;
    return { target: target ? { x: target.x, y: target.y, route: true, task } : null,
        holding: !target || near(person, target) };
}

// Only an actual completed social encounter calls this; no new per-frame search.
export function attempt_theft(world, person, companion) {
    const eligible = unit => unit && unit.health > 0 && unit.role !== 'soldier'
        && unit.age / world.year_length >= 18 && !unit.prisoner_of && !unit.voyage_id
        && !unit.recovering && !unit.medical_role
        && !world.machines.some(machine => machine.crew_id === unit.id);
    if (!has_trait(person, 'thief') || has_trait(person, 'honest') || !eligible(person)
        || !eligible(companion) || person.id === companion.id
        || person.village_id !== companion.village_id
        || Math.hypot(person.x - companion.x, person.y - companion.y) >= 4
        || !world.walkable(person.x, person.y) || !world.walkable(companion.x, companion.y)) return null;
    const same_tile = world.index(person.x, person.y) === world.index(companion.x, companion.y);
    if (!same_tile && !find_path(world, person, companion, 256).length) return null;
    const cargo = person.daily_life?.cargo, carried = companion.daily_life?.cargo;
    if (!cargo || !carried) return null;
    for (const [good, capacity] of [['food', 12], ['wood', 8]]) {
        if (!Number.isFinite(cargo[good]) || !Number.isFinite(carried[good])
            || cargo[good] < 0 || carried[good] < 0 || cargo[good] > capacity || carried[good] > capacity) continue;
        const amount = Math.min(1, Math.max(0, carried[good]), Math.max(0, capacity - cargo[good]));
        if (!amount) continue;
        carried[good] -= amount; cargo[good] += amount;
        person.trait_thefts = Math.min(1e6, (person.trait_thefts || 0) + 1);
        adjust_relationship(companion, person, -5);
        const quantity = Number(amount.toFixed(2)) || 'a little';
        const label = good === 'wood' ? 'timber' : good;
        world.note_character_event?.(person,
            `Pilfered ${quantity} ${label} from ${companion.name || 'a neighbor'}'s carried supplies.`);
        world.note_character_event?.(companion,
            `${person.name || 'A neighbor'} took ${quantity} ${label} from carried supplies.`);
        return { good, amount, victim_id: companion.id };
    }
    return null;
}

// Replaces civilian gather credits. Subsistence remains immediate to sustain early settlements;
// only the additional harvest is carried. Farm stock is debited, never recreated here.
export function collect_daily_goods(world, person, kingdom, food, wood) {
    const state = initialize_daily_life(person);
    if (person.age / world.year_length < 18) return { food: 0, wood: 0 };
    const result = { food: food * 0.6, wood: 0 };
    if (state.phase !== 'work'
        || !state.site || !near(person, state.site)) return result;
    const i = world.index(state.site.x, state.site.y);
    const farm = state.site.kind === 'farm' && kingdom.buildings?.find(building => building.type === 'farm'
        && building.x === state.site.x && building.y === state.site.y);
    let harvest = 0;
    if (farm) {
        harvest = Math.min(Math.max(0, farm.stock || 0), 4, 12 - state.cargo.food);
        farm.stock = Math.max(0, (farm.stock || 0) - harvest);
    } else if (state.site.kind === 'forage') {
        harvest = Math.min(food * 0.4, 12 - state.cargo.food, world.fertility[i] * 40);
        world.fertility[i] = Math.max(0, world.fertility[i] - harvest / 40);
    }
    state.cargo.food += harvest;
    if (state.site.kind === 'forest' && WOODED.has(world.tile(state.site.x, state.site.y))) {
        const timber = harvest_tree(world, state.site.x, state.site.y, Math.min(wood, 8 - state.cargo.wood));
        state.cargo.wood += timber;
    }
    return result;
}

export function valid_daily_life(state, width, height) {
    if (state === undefined) return true;
    const number = (n, max) => Number.isFinite(n) && n >= 0 && n <= max;
    return !!state && PHASES.includes(state.phase) && number(state.energy, 100)
        && number(state.timer, 120) && number(state.delivered, 1e6) && number(state.cycles, 1e6)
        && !!state.cargo && number(state.cargo.food, 12) && number(state.cargo.wood, 8)
        && (state.partner_id === null || Number.isSafeInteger(state.partner_id) && state.partner_id > 0)
        && (state.site === null || !!state.site && number(state.site.x, width - 0.001)
            && number(state.site.y, height - 0.001) && SITE_KINDS.has(state.site.kind)
            && (state.site.ore_x === undefined && state.site.ore_y === undefined
                || state.site.kind === 'mine' && Number.isInteger(state.site.ore_x) && Number.isInteger(state.site.ore_y)
                && number(state.site.ore_x, width - 1) && number(state.site.ore_y, height - 1)));
}
