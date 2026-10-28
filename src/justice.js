import { creature_stats } from './creatures.js';
import { has_trait } from './character_traits.js';
import { neighbors, note_event } from './needs.js';
import { land_route } from './settlement_land.js';
import { can_step } from './pathfinding.js';

export const JUSTICE = Object.freeze({ max_cases: 128, officers: 3, cells: 4,
    service_radius: 18, patrol_radius: 8, witness_radius: 5, sentence: 12,
    case_lifetime: 180, refresh: 1, patrol_interval: 8, notice_probability: 0.6 });
const ACTIVE = new Set(['open', 'pursuit', 'escort', 'jailed']);
const STATES = new Set(['unreported', ...ACTIVE, 'closed', 'expired']);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sees = (world, a, b) => {
    const steps = Math.max(1, Math.ceil(distance(a, b) * 2));
    for (let i = 0; i <= steps; i++) if (!world.walkable(a.x + (b.x - a.x) * i / steps,
        a.y + (b.y - a.y) * i / steps)) return false;
    return true;
};
export const empty_justice = () => ({ next_id: 1, clock: 0, cases: [], patrols: [] });
export const justice_busy = (world, p) => Boolean(world._police_ids?.has(p.id)
    || world._justice_custody?.has(p.id));
const station_at = (world, kingdom_id, x, y) => world.villages.find(k => k.id === kingdom_id && k.alive)
    ?.buildings?.find(b => b.type === 'police_station' && b.x === x && b.y === y
        && world.walkable(x, y) && !world.fire[world.index(x, y)]);
const fit = (world, p) => p && p.health >= creature_stats(p, world.year_length).max_health * 0.5
    && p.age / world.year_length >= 18 && p.role !== 'soldier' && !p.prisoner_of
    && !p.voyage_id && !p.medical_role && !p.recovering && !p.infection
    && !(world.remains || []).some(r => r.carrier_id === p.id)
    && !world.machines.some(m => m.crew_id === p.id)
    && (p.needs?.nutrition ?? 100) > 25 && (p.needs?.hydration ?? 100) > 25
    && (p.needs?.energy ?? 100) > 20;

// Derived indexes are rebuilt after loading; inspection never calls an advance function.
export function rebuild_justice(world) {
    const people = new Map(world.people.map(p => [p.id, p]));
    world._police_ids = new Set(); world._justice_custody = new Map();
    world._justice_intents = new Map();
    for (const p of world.justice.patrols) if (people.get(p.officer_id)?.health > 0
        && people.get(p.officer_id).village_id === p.kingdom_id
        && station_at(world, people.get(p.officer_id).village_id, p.x, p.y)) world._police_ids.add(p.officer_id);
    for (const c of world.justice.cases) if (['escort', 'jailed'].includes(c.status)) {
        const station = station_at(world, c.kingdom_id, c.station_x, c.station_y);
        if (station && people.get(c.suspect_id)?.health > 0) world._justice_custody.set(c.suspect_id, { case: c, station });
    }
}

export function record_theft(world, thief, victim, good, amount) {
    world.justice ||= empty_justice();
    const j = world.justice;
    if (j.cases.length >= JUSTICE.max_cases) {
        const old = j.cases.findIndex(c => !ACTIVE.has(c.status));
        if (old < 0) return null;
        j.cases.splice(old, 1);
    }
    const nearby = world._justice_context ? neighbors(world._justice_context, thief, JUSTICE.witness_radius) : [];
    const witnesses = nearby.filter(p => p.id !== victim.id && p.village_id === thief.village_id
        && p.age / world.year_length >= 18 && !world._justice_custody?.has(p.id))
        .slice(0, 8).filter(p => sees(world, p, thief)).map(p => p.id);
    // The victim can notice the actual theft too; no accusation is invented by this roll.
    if ((world.random?.() ?? 1) < JUSTICE.notice_probability) witnesses.unshift(victim.id);
    const c = { id: j.next_id++, kingdom_id: thief.village_id, suspect_id: thief.id,
        suspect_name: thief.name, victim_id: victim.id, victim_name: victim.name,
        x: thief.x, y: thief.y, time: world.time, good, amount, recovered: 0,
        witnesses: witnesses.slice(0, 8), status: witnesses.length ? 'open' : 'unreported',
        officer_id: null, station_x: null, station_y: null, remaining: 0, outcome: '' };
    j.cases.push(c);
    note_event(world, thief, witnesses.length ? 'The theft was witnessed.' : 'The theft went unnoticed.');
    return c;
}

// Restitution debits goods still carried by the suspect. Spent goods are never recreated.
export function recover_goods(world, c) {
    const thief = world.people.find(p => p.id === c.suspect_id && p.health > 0);
    const victim = world.people.find(p => p.id === c.victim_id && p.health > 0);
    const kingdom = world.villages.find(k => k.id === c.kingdom_id && k.alive);
    const cargo = thief?.daily_life?.cargo;
    const amount = Math.min(c.amount - c.recovered, Math.max(0, cargo?.[c.good] || 0));
    if (!(amount > 0) || !kingdom) return 0;
    const returned = victim?.village_id === c.kingdom_id ? victim.daily_life?.cargo : null;
    const capacity = c.good === 'food' ? 12 : 8;
    const carried = returned ? Math.min(amount, Math.max(0, capacity - (returned[c.good] || 0))) : 0;
    cargo[c.good] -= amount;
    if (carried) returned[c.good] += carried;
    kingdom[c.good] += amount - carried;
    c.recovered += amount;
    return amount;
}

function close_case(world, c, outcome) {
    c.status = 'closed'; c.remaining = 0; c.outcome = outcome;
    const p = world.people.find(p => p.id === c.suspect_id);
    if (p) note_event(world, p, outcome);
    world.log(`${c.suspect_name}: ${outcome}`, 'life', p || c);
}

function staff(world) {
    const j = world.justice, previous = new Map(j.patrols.map(p => [p.officer_id, p]));
    const patrols = [], reserved = new Set(j.cases.filter(c => ['escort', 'jailed'].includes(c.status)).map(c => c.suspect_id));
    for (const k of world.villages.filter(k => k.alive)) {
        const station = k.buildings?.find(b => station_at(world, k.id, b.x, b.y) === b);
        if (!station) continue;
        const residents = world.people.filter(p => p.village_id === k.id && p.health > 0);
        if (residents.length < 12) continue;
        const adults_by_home = new Map();
        for (const p of residents) if (p.age / world.year_length >= 18 && p.role !== 'soldier') {
            adults_by_home.set(p.home_id, (adults_by_home.get(p.home_id) || 0) + 1);
        }
        const candidates = residents.filter(p => fit(world, p) && !reserved.has(p.id)
            && (adults_by_home.get(p.home_id) || 0) >= 5
            && p.id !== k.king_id && !has_trait(p, 'thief')
            && !j.cases.some(c => c.suspect_id === p.id && ACTIVE.has(c.status))
            && distance(p, station) <= JUSTICE.service_radius)
            .sort((a, b) => Number(previous.has(b.id)) - Number(previous.has(a.id))
                || Number(has_trait(b, 'honest')) - Number(has_trait(a, 'honest')) || a.id - b.id);
        const limit = Math.min(JUSTICE.officers, Math.ceil(residents.length / 50));
        for (const p of candidates.slice(0, limit * 3)) {
            if (patrols.filter(q => q.x === station.x && q.y === station.y && q.kingdom_id === k.id).length >= limit) break;
            if (!land_route(world, p, station)) continue;
            const old = previous.get(p.id);
            patrols.push(old?.x === station.x && old?.y === station.y && old?.kingdom_id === k.id ? old
                : { officer_id: p.id, kingdom_id: k.id, x: station.x, y: station.y,
                    target_x: station.x, target_y: station.y, timer: 0 });
        }
    }
    j.patrols = patrols;
}

export function advance_justice(world, dt) {
    const j = world.justice;
    rebuild_justice(world);
    const people = new Map(world.people.map(p => [p.id, p]));
    for (const c of j.cases) {
        if (!ACTIVE.has(c.status)) continue;
        const p = people.get(c.suspect_id), k = world.villages.find(k => k.id === c.kingdom_id && k.alive);
        if (!p || p.health <= 0 || !k || p.village_id !== c.kingdom_id || p.prisoner_of || p.voyage_id) {
            close_case(world, c, 'Case closed: person or jurisdiction unavailable.'); continue;
        }
        if (['escort', 'jailed'].includes(c.status)) {
            const station = station_at(world, c.kingdom_id, c.station_x, c.station_y);
            if (!station || world.fire[world.index(p.x, p.y)] > 0
                || c.status === 'jailed' && distance(p, station) > 2
                || (p.needs?.hydration ?? 100) < 10 || (p.needs?.nutrition ?? 100) < 10
                || p.health < creature_stats(p, world.year_length).max_health * 0.5) {
                close_case(world, c, 'Released because safe detention could not be maintained.'); continue;
            }
            if (c.status === 'jailed') {
                c.remaining = Math.max(0, c.remaining - dt);
                if (p.daily_life) p.daily_life.energy = Math.min(100, p.daily_life.energy + dt * 2);
                if (!c.remaining) close_case(world, c, 'Released after serving a short theft sentence.');
            }
        } else if (world.time - c.time > JUSTICE.case_lifetime) {
            c.status = 'expired'; c.outcome = 'No reachable response before the case expired.';
        }
    }
    j.clock += dt;
    const dispatch = j.clock >= JUSTICE.refresh;
    if (dispatch) { j.clock %= JUSTICE.refresh; staff(world); }
    rebuild_justice(world);
    for (const c of j.cases.filter(c => ['pursuit', 'escort'].includes(c.status))) {
        if (!world._police_ids.has(c.officer_id)) {
            if (c.status === 'escort') close_case(world, c, 'Released because the escort became unavailable.');
            else { c.status = 'open'; c.officer_id = null; }
        }
    }
    const assigned = new Set(j.cases.filter(c => ['pursuit', 'escort'].includes(c.status)).map(c => c.officer_id));
    for (const patrol of j.patrols) {
        const officer = people.get(patrol.officer_id);
        if (!officer || !world._police_ids.has(officer.id)) continue;
        if (officer.daily_life) officer.daily_life.energy = Math.max(0, officer.daily_life.energy - dt * 0.4);
        const station = station_at(world, officer.village_id, patrol.x, patrol.y);
        let c = j.cases.find(c => c.officer_id === officer.id && ['pursuit', 'escort'].includes(c.status));
        if (!c && !assigned.has(officer.id) && dispatch) {
            const occupied = j.cases.filter(c => c.kingdom_id === officer.village_id
                && ['escort', 'jailed'].includes(c.status)).length;
            if (occupied < JUSTICE.cells) c = j.cases.filter(c => c.status === 'open'
                && c.kingdom_id === officer.village_id && c.witnesses.length
                && !world._justice_custody.has(c.suspect_id))
                .slice(0, 8).find(c => { const p = people.get(c.suspect_id);
                    return p && distance(p, station) <= JUSTICE.service_radius && land_route(world, officer, p); });
            if (c) { c.status = 'pursuit'; c.officer_id = officer.id; c.station_x = station.x; c.station_y = station.y; assigned.add(officer.id); }
        }
        let target = { x: patrol.target_x, y: patrol.target_y }, action = 'Patrolling', reason = 'Checking a reachable route around the constabulary.';
        if (c) {
            const suspect = people.get(c.suspect_id);
            if (c.status === 'pursuit' && distance(officer, suspect) <= 1.5
                && sees(world, officer, suspect) && can_step(world, officer, suspect.x, suspect.y)) {
                const occupied = j.cases.filter(q => q.kingdom_id === c.kingdom_id && ['escort', 'jailed'].includes(q.status)).length;
                if (occupied < JUSTICE.cells) {
                    c.status = 'escort'; recover_goods(world, c);
                    note_event(world, suspect, 'A police officer is escorting me for a witnessed theft.');
                    world.log(`${officer.name} apprehends ${suspect.name} for witnessed theft; ${c.recovered} ${c.good} recovered.`, 'life', suspect);
                }
            }
            target = c.status === 'escort' ? station : suspect;
            action = c.status === 'escort' ? 'Escorting offender' : 'Responding to theft';
            reason = `Witnessed theft case #${c.id}; arrest is nonlethal.`;
            if (c.status === 'escort' && distance(suspect, station) <= 1.5 && distance(officer, station) <= 2) {
                c.status = 'jailed'; c.remaining = JUSTICE.sentence;
                note_event(world, suspect, `Serving ${JUSTICE.sentence} simulation seconds for witnessed theft.`);
            }
        } else {
            patrol.timer -= dt;
            if (patrol.timer <= 0 || !world.walkable(target.x, target.y)) {
                patrol.timer = JUSTICE.patrol_interval;
                for (let attempt = 0; attempt < 6; attempt++) {
                    const angle = world.random() * Math.PI * 2, radius = 2 + world.random() * (JUSTICE.patrol_radius - 2);
                    const p = { x: station.x + Math.cos(angle) * radius, y: station.y + Math.sin(angle) * radius };
                    if (world.territory_at(p.x, p.y) === officer.village_id && !world.fire[world.index(p.x, p.y)] && land_route(world, officer, p)) {
                        patrol.target_x = p.x; patrol.target_y = p.y; target = p; break;
                    }
                }
            }
        }
        world._justice_intents.set(officer.id, { action, reason, target: { x: target.x, y: target.y, route: true }, holding: distance(officer, target) <= 1 });
    }
    // Booked cases release the escort; custody itself remains authoritative until its timer ends.
    world._justice_custody.clear();
    for (const c of j.cases.filter(c => ['escort', 'jailed'].includes(c.status))) {
        const station = station_at(world, c.kingdom_id, c.station_x, c.station_y), p = people.get(c.suspect_id);
        if (!station || !p) continue;
        world._justice_custody.set(p.id, { case: c, station });
        world._justice_intents.set(p.id, { custody: true, action: c.status === 'jailed' ? 'Serving theft sentence' : 'Being escorted',
            reason: `Witnessed theft case #${c.id}${c.status === 'jailed' ? `; ${c.remaining.toFixed(1)} simulation seconds remain.` : '; walking to the civilian jail.'}`,
            target: { x: station.x, y: station.y, route: true }, holding: c.status === 'jailed' || distance(p, station) <= 1 });
    }
}

export const justice_intent = (world, person) => world._justice_intents?.get(person.id) || null;

export function justice_summary(world, kingdom_id) {
    const cases = (world.justice?.cases || []).filter(c => c.kingdom_id === kingdom_id);
    const officers = (world.justice?.patrols || []).filter(p => p.kingdom_id === kingdom_id
        && world.people.some(q => q.id === p.officer_id && q.health > 0 && q.village_id === kingdom_id)
        && station_at(world, kingdom_id, p.x, p.y));
    const stations = world.villages.find(k => k.id === kingdom_id && k.alive)?.buildings?.filter(b => station_at(world, kingdom_id, b.x, b.y) === b) || [];
    const residents = world.people.filter(p => p.village_id === kingdom_id && p.health > 0);
    const kingdom = world.villages.find(k => k.id === kingdom_id && k.alive);
    const homes = kingdom ? [kingdom, ...world.colonies.filter(c => c.kingdom_id === kingdom_id)] : [];
    const staffed = stations.filter(s => officers.some(p => p.x === s.x && p.y === s.y));
    const served_homes = new Set(homes.filter(h => staffed.some(s => distance(h, s) <= JUSTICE.service_radius && land_route(world, h, s))).map(h => h.id));
    return { officers: officers.length, stations: stations.length, capacity: stations.length ? JUSTICE.cells : 0,
        coverage: officers.length && residents.length ? Math.round(residents.filter(p => served_homes.has(p.home_id || p.village_id)).length / residents.length * 100) : 0,
        pending: cases.filter(c => ['open', 'pursuit', 'escort'].includes(c.status)).length,
        unreported: cases.filter(c => c.status === 'unreported').length,
        jailed: cases.filter(c => c.status === 'jailed').length,
        recovered: cases.reduce((sum, c) => sum + c.recovered, 0), recent: cases.slice(-6).reverse() };
}

export function valid_justice(data, width, height) {
    if (data.justice === undefined) return true;
    const j = data.justice, num = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;
    const id = n => Number.isInteger(n) && n > 0 && n < data.next_id;
    const point = (x, y) => num(x, 0, width - 0.0001) && num(y, 0, height - 0.0001);
    if (!j || !Number.isInteger(j.next_id) || j.next_id < 1 || j.next_id > 1e9
        || !num(j.clock, 0, JUSTICE.refresh) || !Array.isArray(j.cases) || j.cases.length > JUSTICE.max_cases
        || !Array.isArray(j.patrols) || j.patrols.length > 360) return false;
    const ids = new Set(), detainees = new Set(), escorts = new Set(), officers = new Set();
    for (const c of j.cases) {
        if (!c || !Number.isInteger(c.id) || c.id < 1 || c.id >= j.next_id || ids.has(c.id)
            || !id(c.kingdom_id) || !data.villages.some(k => k.id === c.kingdom_id)
            || !id(c.suspect_id) || !id(c.victim_id) || c.suspect_id === c.victim_id
            || ![c.suspect_name, c.victim_name].every(s => typeof s === 'string' && s.length > 0 && s.length <= 40)
            || !point(c.x, c.y) || !num(c.time, 0, data.time) || !['food', 'wood'].includes(c.good)
            || !num(c.amount, Number.MIN_VALUE, 1) || !num(c.recovered, 0, c.amount) || !STATES.has(c.status)
            || !Array.isArray(c.witnesses) || c.witnesses.length > 8 || !c.witnesses.every(id)
            || new Set(c.witnesses).size !== c.witnesses.length || c.witnesses.includes(c.suspect_id)
            || (c.officer_id !== null && !id(c.officer_id))
            || !num(c.remaining, 0, JUSTICE.sentence) || typeof c.outcome !== 'string' || c.outcome.length > 160) return false;
        if (c.officer_id === c.suspect_id || c.status === 'open' && !c.witnesses.length
            || c.status === 'unreported' && c.witnesses.length
            || c.status !== 'jailed' && c.remaining !== 0
            || !((c.station_x === null && c.station_y === null) || point(c.station_x, c.station_y))) return false;
        if (['pursuit', 'escort', 'jailed'].includes(c.status) && (!c.witnesses.length || !id(c.officer_id) || !point(c.station_x, c.station_y))) return false;
        if (['escort', 'jailed'].includes(c.status)) { if (detainees.has(c.suspect_id)) return false; detainees.add(c.suspect_id); }
        if (['pursuit', 'escort'].includes(c.status)) { if (escorts.has(c.officer_id)) return false; escorts.add(c.officer_id); }
        ids.add(c.id);
    }
    for (const p of j.patrols) {
        if (!p || !id(p.officer_id) || officers.has(p.officer_id) || detainees.has(p.officer_id) || !id(p.kingdom_id)
            || !data.villages.some(k => k.id === p.kingdom_id) || !point(p.x, p.y) || !point(p.target_x, p.target_y)
            || !num(p.timer, 0, JUSTICE.patrol_interval)) return false;
        officers.add(p.officer_id);
    }
    return data.villages.every(k => j.cases.filter(c => c.kingdom_id === k.id && ['escort', 'jailed'].includes(c.status)).length <= JUSTICE.cells);
}
