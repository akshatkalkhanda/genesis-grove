import { find_path } from './pathfinding.js';

export const FUNERALS = Object.freeze({ max_remains: 128, max_records: 12,
    decay_seconds: 180, burial_seconds: 4, cremation_seconds: 8, cremation_wood: 2 });
const METHODS = new Set(['burial', 'cremation']);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ready = (world, person) => person.health > 50 && person.role !== 'soldier'
    && person.age / world.year_length >= 18 && !person.voyage_id && !person.prisoner_of
    && !person.medical_role && !person.recovering && !world._crew_assignments?.has(person.id)
    && !world.machines.some(m => m.crew_id === person.id)
    && (person.needs?.hydration ?? 100) > 55
    && (person.needs?.nutrition ?? 100) > 40 && (person.needs?.energy ?? 100) > 25
    && world.walkable(person.x, person.y) && !world.fire[world.index(person.x, person.y)];
const safe = (world, point) => world.walkable(point.x, point.y)
    && !world.fire[world.index(point.x, point.y)];
const reachable = (world, a, b) => safe(world, a) && safe(world, b)
    && (distance(a, b) <= 1 || find_path(world, a, b, 1024).length > 0);

function cemetery_for(world, kingdom_id) {
    let cemetery = world.cemeteries.find(c => c.kingdom_id === kingdom_id);
    // Graves stay where they were laid; flooding must not teleport a cemetery.
    if (cemetery) return cemetery;
    const home = world.villages.find(v => v.id === kingdom_id);
    if (!home) return null;
    // A small quiet plot outside the central settlement. No seeded RNG is consumed.
    const sites = [...world.villages, ...world.colonies];
    for (let radius = 6; radius <= 12; radius += 2) {
        for (const [dx, dy] of [[radius, 0], [0, radius], [-radius, 0], [0, -radius]]) {
            const point = { x: Math.floor(home.x + dx) + 0.5, y: Math.floor(home.y + dy) + 0.5 };
            if (!safe(world, point) || world.roads[world.index(point.x, point.y)]
                || sites.some(site => [site, ...(site.houses || []), ...(site.buildings || [])]
                    .some(b => distance(b, point) < 3)) || !reachable(world, home, point)) continue;
            cemetery = { kingdom_id, ...point, buried: 0, cremated: 0, unrecovered: 0, records: [] };
            world.cemeteries.push(cemetery);
            world.revision++;
            return cemetery;
        }
    }
    return null;
}

function remember(world, cemetery, remains, method) {
    if (!cemetery) return;
    if (cemetery.records.some(record => record.id === remains.id)) return;
    const counter = method === 'burial' ? 'buried' : method === 'cremation' ? 'cremated' : 'unrecovered';
    cemetery[counter] = Math.min(1e9, cemetery[counter] + 1);
    cemetery.records.unshift({ id: remains.id, name: remains.name, race: remains.race,
        age_years: remains.age_years, cause: remains.cause, method, year: world.year });
    cemetery.records.length = Math.min(FUNERALS.max_records, cemetery.records.length);
}

export function record_death(world, person) {
    const cause = person.health_history?.[0]?.cause
        || (!world.walkable(person.x, person.y) ? 'terrain' : 'unknown');
    if (cause === 'erase' || world.remains.some(r => r.id === person.id)
        || world.cemeteries.some(c => c.records.some(r => r.id === person.id))) return;
    const remains = { id: person.id, name: person.name, race: person.race,
        kingdom_id: person.village_id, x: person.x, y: person.y,
        age_years: Math.floor(person.age / world.year_length), cause, age: 0,
        carrier_id: null, stage: 'waiting', timer: 0, method: null, paid: false };
    const cemetery = cemetery_for(world, person.village_id);
    if (!world.walkable(person.x, person.y)) { remember(world, cemetery, remains, 'lost'); return; }
    if (world.remains.length >= FUNERALS.max_remains) {
        const oldest = world.remains.shift();
        remember(world, world.cemeteries.find(c => c.kingdom_id === oldest.kingdom_id), oldest, 'lost');
    }
    world.remains.push(remains);
}

export function advance_funerals(world, dt) {
    const living = new Map(world.people.filter(p => p.health > 0).map(p => [p.id, p]));
    for (const body of world.remains) {
        body.age = Math.min(FUNERALS.decay_seconds, body.age + dt);
        const carrier = living.get(body.carrier_id);
        if (body.carrier_id && (!carrier || !ready(world, carrier)
            || carrier.village_id !== body.kingdom_id)) {
            body.carrier_id = null;
            // Paid rites stay paid when interrupted, rather than charging twice.
            if (body.stage !== 'rites') body.stage = 'waiting';
        }
        if (body.stage === 'carry' && carrier && body.carrier_id) { body.x = carrier.x; body.y = carrier.y; }
        if (body.age >= FUNERALS.decay_seconds) {
            remember(world, world.cemeteries.find(c => c.kingdom_id === body.kingdom_id), body, 'lost');
        }
    }
    world.remains = world.remains.filter(body => body.age < FUNERALS.decay_seconds);
}

export function prepare_funerals(world) {
    world._funeral_assignments = new Map();
    for (const body of world.remains) if (body.carrier_id) world._funeral_assignments.set(body.carrier_id, body);
    if (world.tick % 8 !== 0 || !world.remains.some(body => !body.carrier_id)) return;
    const by_kingdom = new Map();
    for (const person of world.people) if (ready(world, person) && !world._funeral_assignments.has(person.id)) {
        const group = by_kingdom.get(person.village_id) || [];
        group.push(person); by_kingdom.set(person.village_id, group);
    }
    const busy = new Set(world.remains.filter(r => r.carrier_id).map(r => r.kingdom_id));
    let budget = 16;
    for (const body of world.remains) {
        if (body.carrier_id || busy.has(body.kingdom_id) || budget <= 0) continue;
        const kingdom = world.villages.find(v => v.id === body.kingdom_id);
        if ((body.method || kingdom?.funeral_method) === 'cremation' && !body.paid
            && (kingdom?.wood || 0) < FUNERALS.cremation_wood) continue;
        const cemetery = cemetery_for(world, body.kingdom_id);
        if (!cemetery || !safe(world, body)) continue;
        const candidates = (by_kingdom.get(body.kingdom_id) || [])
            .filter(p => !world._funeral_assignments.has(p.id) && distance(p, body) < 32)
            .sort((a, b) => distance(a, body) - distance(b, body) || a.id - b.id);
        for (const person of candidates.slice(0, 2)) {
            if (--budget < 0) break;
            if (!reachable(world, person, body) || !reachable(world, body, cemetery)) continue;
            body.carrier_id = person.id;
            world._funeral_assignments.set(person.id, body);
            busy.add(body.kingdom_id);
            break;
        }
    }
}

export function funeral_intent(world, person, dt) {
    const body = world._funeral_assignments?.get(person.id);
    if (!body || !world.remains.includes(body) || !ready(world, person)) return null;
    const cemetery = world.cemeteries.find(c => c.kingdom_id === body.kingdom_id);
    if (!cemetery || !safe(world, cemetery) || !safe(world, body)) return null;
    let target = body.stage === 'waiting' ? body : cemetery;
    if (body.stage === 'waiting' && distance(person, body) < 1.25) body.stage = 'carry';
    if (body.stage === 'carry') {
        body.x = person.x; body.y = person.y; target = cemetery;
        if (distance(person, cemetery) < 1.25) {
            body.stage = 'rites'; body.x = cemetery.x; body.y = cemetery.y;
        }
    }
    if (person.daily_life) person.daily_life.energy = Math.max(0, person.daily_life.energy - dt * 0.3);
    const kingdom = world.villages.find(v => v.id === body.kingdom_id);
    if (body.stage === 'rites' && distance(person, cemetery) < 1.25) {
        body.method ||= METHODS.has(kingdom?.funeral_method) ? kingdom.funeral_method : 'burial';
        if (body.method === 'cremation' && !body.paid) {
            if (!kingdom || kingdom.wood < FUNERALS.cremation_wood) {
                person.task = 'Awaiting funeral timber';
                body.carrier_id = null; world._funeral_assignments.delete(person.id);
                return { target: null, holding: true, reason: 'Cremation needs two timber; no extra stock is created.' };
            }
            kingdom.wood -= FUNERALS.cremation_wood; body.paid = true;
        }
        body.timer = Math.min(FUNERALS.cremation_seconds, body.timer + dt);
        person.task = body.method === 'burial' ? 'Burying the deceased' : 'Tending a funeral pyre';
        if (body.timer >= (body.method === 'burial' ? FUNERALS.burial_seconds : FUNERALS.cremation_seconds)) {
            remember(world, cemetery, body, body.method);
            world.remains.splice(world.remains.indexOf(body), 1);
            world._funeral_assignments.delete(person.id);
            world.effects.push({ type: 'funeral', x: cemetery.x, y: cemetery.y, radius: 1,
                life: 1, duration: 1.2, method: body.method });
            world.note_character_event?.(person, `Laid ${body.name} to rest at the cemetery.`);
        }
        return { target: null, holding: true, reason: 'Giving a deceased neighbor a funeral.' };
    }
    person.task = body.stage === 'waiting' ? 'Collecting the deceased' : 'Carrying the deceased';
    return { target: { x: target.x, y: target.y, route: true }, holding: distance(person, target) < 1,
        reason: 'Taking a deceased neighbor to the community cemetery.' };
}

export function valid_funerals(data, width, height) {
    const num = (n, max = 1e9) => Number.isFinite(n) && n >= 0 && n <= max;
    const id = n => Number.isSafeInteger(n) && n > 0 && n < data.next_id;
    const point = p => num(p.x, width - 0.00001) && num(p.y, height - 0.00001);
    const text = s => typeof s === 'string' && s.length <= 100;
    const kingdoms = new Set(data.villages.map(v => v.id));
    const seen = new Set(), owners = new Set(), carriers = new Set();
    const living = new Set(data.people.filter(p => p.health > 0).map(p => p.id));
    const identity = r => r && id(r.id) && !living.has(r.id) && text(r.name) && text(r.race) && text(r.cause) && num(r.age_years);
    if (data.villages.some(v => v.funeral_method !== undefined && !METHODS.has(v.funeral_method))) return false;
    if (data.remains !== undefined && (!Array.isArray(data.remains) || data.remains.length > FUNERALS.max_remains)) return false;
    if (data.cemeteries !== undefined && (!Array.isArray(data.cemeteries) || data.cemeteries.length > data.villages.length)) return false;
    for (const r of data.remains || []) {
        if (!identity(r) || seen.has(r.id) || !kingdoms.has(r.kingdom_id) || !point(r)
            || !num(r.age, FUNERALS.decay_seconds) || !num(r.timer, FUNERALS.cremation_seconds)
            || !['waiting', 'carry', 'rites'].includes(r.stage) || !(r.method === null || METHODS.has(r.method))
            || typeof r.paid !== 'boolean' || (r.paid && r.method !== 'cremation')
            || !(r.carrier_id === null || id(r.carrier_id) && r.carrier_id !== r.id && !carriers.has(r.carrier_id))) return false;
        seen.add(r.id); if (r.carrier_id) carriers.add(r.carrier_id);
    }
    for (const c of data.cemeteries || []) {
        if (!c || !kingdoms.has(c.kingdom_id) || owners.has(c.kingdom_id) || !point(c)
            || ![c.buried, c.cremated, c.unrecovered].every(n => Number.isSafeInteger(n) && num(n))
            || !Array.isArray(c.records) || c.records.length > FUNERALS.max_records) return false;
        owners.add(c.kingdom_id);
        for (const r of c.records) {
            if (!identity(r) || seen.has(r.id) || !['burial', 'cremation', 'lost'].includes(r.method)
                || !num(r.year)) return false;
            seen.add(r.id);
        }
    }
    return true;
}
