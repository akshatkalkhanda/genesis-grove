import { creature_stats } from './creatures.js';

export const MEDICAL_BUILDINGS = new Set(['clinic', 'hospital']);
const HERB_TERRAIN = new Set([3, 4, 9, 10, 12, 13, 15]);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const available = p => p.health > 0 && !p.voyage_id && !p.prisoner_of;
const connected = (world, a, b) => !world._army_masses
    || world._army_masses[world.index(a.x, a.y)] === world._army_masses[world.index(b.x, b.y)];
const recovery_factor = (p, world) => Math.max(0.1, 1 - Math.max(0, p.age / world.year_length - 85) / 30);

export function prepare_medicine(world) {
    world._medical_sites = new Map();
    world._medical_doctors = new Map();
    const previous = new Set(world.people.filter(p => p.medical_role === 'doctor').map(p => p.id));
    for (const person of world.people) delete person.medical_role;
    for (const kingdom of world.villages) {
        if (!kingdom.alive) continue;
        const sites = (kingdom.buildings || []).filter(b => MEDICAL_BUILDINGS.has(b.type)
            && world.walkable(b.x, b.y) && !world.fire[world.index(b.x, b.y)]);
        if (!sites.length) continue;
        const adults = world.people.filter(p => p.village_id === kingdom.id && available(p) && !world._crew_assignments?.has(p.id)
            && p.role !== 'soldier' && p.age / world.year_length >= 18);
        const slots = sites.flatMap(site => site.type === 'hospital' ? [site, site] : [site]);
        const candidates = adults.filter(p => !p.recovering && !p.infection
            && p.health >= creature_stats(p, world.year_length).max_health * 0.6)
            .sort((a, b) => Number(previous.has(b.id)) - Number(previous.has(a.id))
                || ({ builder: 0, smith: 1, miner: 2, farmer: 3, lumberjack: 4 }[a.job] ?? 5)
                - ({ builder: 0, smith: 1, miner: 2, farmer: 3, lumberjack: 4 }[b.job] ?? 5)
                || a.id - b.id);
        // Keep an adult food gatherer and timber worker in the settlement.
        const protected_ids = new Set(['farmer', 'lumberjack'].map(job => adults.find(p => p.job === job)?.id));
        world._medical_sites.set(kingdom.id, sites);
        const assigned = new Set();
        for (const site of slots) {
            const doctor = candidates.find(p => !protected_ids.has(p.id) && !assigned.has(p.id)
                && connected(world, p, site));
            if (!doctor) continue;
            assigned.add(doctor.id);
            doctor.medical_role = 'doctor';
            world._medical_doctors.set(doctor.id, site);
        }
    }
}

function herb_source(world, site) {
    const mass = world._army_masses?.[world.index(site.x, site.y)];
    let best = null, nearest = Infinity;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        const x = Math.floor(site.x) + dx, y = Math.floor(site.y) + dy;
        if (!world.inside(x, y)) continue;
        const i = world.index(x, y);
        if (!HERB_TERRAIN.has(world.tile(x, y)) || world.fertility[i] < 0.15 || world.fire[i]
            || (mass !== undefined && world._army_masses[i] !== mass)) continue;
        const gap = dx * dx + dy * dy;
        if (gap < nearest) { nearest = gap; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    return best;
}

function doctor_intent(world, person, site, dt) {
    const work = person.medical_work ||= { timer: 0, cargo: 0, source: null };
    site.stock ||= 0;
    const capacity = site.type === 'hospital' ? 120 : 60;
    if (work.cargo > 0) {
        person.task = 'Delivering medicine';
        if (distance(person, site) > 2) return { target: { ...site, route: true }, holding: false };
        const deposit = Math.min(work.cargo, Math.max(0, capacity - site.stock));
        site.stock += deposit; work.cargo -= deposit;
    }
    if (site.stock < 1) {
        if (work.source && (!world.walkable(work.source.x, work.source.y)
            || world.fire[world.index(work.source.x, work.source.y)]
            || world.fertility[world.index(work.source.x, work.source.y)] < 0.15)) work.source = null;
        work.source ||= herb_source(world, site);
        if (work.source) {
            person.task = 'Gathering medicinal herbs';
            if (distance(person, work.source) > 1.25) return { target: { ...work.source, route: true }, holding: false };
            work.timer = Math.min(6, work.timer + dt);
            if (work.timer >= 6) {
                const i = world.index(work.source.x, work.source.y);
                const herbs = Math.min(3, world.fertility[i] * 20);
                world.fertility[i] = Math.max(0, world.fertility[i] - herbs / 50);
                work.cargo = herbs; work.timer = 0; work.source = null;
            }
            return { target: null, holding: true };
        }
    }
    work.timer = 0; work.source = null;
    person.task = site.stock < 1 ? 'Awaiting medicinal herbs' : 'Tending patients';
    return { target: { x: site.x, y: site.y, route: true }, holding: distance(person, site) <= 2 };
}

export function medical_intent(world, person, kingdom, home, dt) {
    const stats = creature_stats(person, world.year_length);
    if (person.health >= stats.max_health * 0.85 && !person.infection) person.recovering = false;
    if (person.health < stats.max_health * 0.6 || person.infection > 0) person.recovering = true;
    const doctor_site = world._medical_doctors?.get(person.id);
    if (doctor_site && !person.recovering) return doctor_intent(world, person, doctor_site, dt);
    // Medicine cannot replace nutrition. During famine, hungry citizens resume
    // gathering rather than wait indefinitely in a clinic with no food to give.
    if (!doctor_site && kingdom.food < 5 && !person.infection
        && person.health_history?.some(entry => entry.cause === 'starvation')) {
        person.recovering = false;
        return null;
    }
    if (!person.recovering) return null;
    const sites = (world._medical_sites?.get(kingdom.id) || [])
        .filter(site => connected(world, person, site));
    const staffed = new Set(world._medical_doctors?.values());
    const destinations = sites.some(site => staffed.has(site)) ? sites.filter(site => staffed.has(site)) : sites;
    const site = destinations.slice()
        .sort((a, b) => distance(person, a) - distance(person, b))[0];
    const destination = site || home;
    const arrived = distance(person, destination) <= 2;
    person.task = !arrived ? site ? 'Seeking medical care' : 'Returning home to recover'
        : site ? 'Waiting for treatment' : 'Recovering at home';
    if (arrived && kingdom.food > 1 && !person.infection) {
        person.health = Math.min(stats.max_health, person.health + dt * 0.3 * recovery_factor(person, world));
    }
    return { target: { x: destination.x, y: destination.y, route: true }, holding: arrived };
}

export function advance_medicine(world, dt) {
    for (const [kingdom_id, sites] of world._medical_sites || []) {
        const kingdom = world.villages.find(v => v.id === kingdom_id && v.alive);
        if (!kingdom) continue;
        for (const site of sites) {
            const doctors = world.people.filter(p => available(p) && p.medical_role === 'doctor'
                && world._medical_doctors.get(p.id) === site && !p.recovering
                && p.task === 'Tending patients' && distance(p, site) <= 2.5);
            if (!doctors.length || !site.stock || kingdom.food <= 1) continue;
            const patients = world.people.filter(p => p.village_id === kingdom_id && available(p)
                && p.recovering && distance(p, site) <= 2.5)
                .sort((a, b) => a.health / creature_stats(a, world.year_length).max_health
                    - b.health / creature_stats(b, world.year_length).max_health || a.id - b.id)
                .slice(0, doctors.length * (site.type === 'hospital' ? 3 : 2));
            for (const patient of patients) {
                const care_time = Math.min(dt, site.stock / 0.08, Math.max(0, kingdom.food - 1) / 0.12);
                if (!care_time) continue;
                site.stock = Math.max(0, site.stock - care_time * 0.08);
                kingdom.food -= care_time * 0.12;
                const max = creature_stats(patient, world.year_length).max_health;
                patient.health = Math.min(max, patient.health + care_time
                    * (site.type === 'hospital' ? 3 : 2) * recovery_factor(patient, world));
                patient.infection = Math.max(0, (patient.infection || 0) - care_time * 0.12);
                patient.task = 'Receiving treatment';
                if (patient.health >= max * 0.85 && !patient.infection) {
                    patient.recovering = false;
                    site.treatments = Math.min(1e6, (site.treatments || 0) + 1);
                }
            }
        }
    }
}

export function valid_medicine(person, point) {
    const w = person.medical_work;
    return (person.medical_role === undefined || person.medical_role === 'doctor')
        && (person.recovering === undefined || typeof person.recovering === 'boolean')
        && (w === undefined || w && Number.isFinite(w.timer) && w.timer >= 0 && w.timer <= 6
            && Number.isFinite(w.cargo) && w.cargo >= 0 && w.cargo <= 3
            && (w.source === null || point(w.source)));
}
