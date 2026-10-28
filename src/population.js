import { select_parents, initialize_child, related } from './society.js';
import { justice_busy } from './justice.js';
import { food_reserve } from './civic.js';
import { is_tree_site } from './forestry.js';

export const POPULATION = Object.freeze({ settlers: 8, settler_max_age: 55,
    birth_seconds: 12, orc_birth_seconds: 8, harefolk_birth_seconds: 8, hyenafolk_birth_seconds: 10 });

export function settlement_resources(world, home) {
    let score = 0;
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const x = Math.floor(home.x) + dx, y = Math.floor(home.y) + dy;
        if (dx * dx + dy * dy > 100 || !world.inside(x, y)) continue;
        if (is_tree_site(world, x, y)) score += 3;
        if (world.ores[world.index(x, y)]) score += 1;
    }
    return score;
}

export function rebalance_settlement_jobs(world, kingdom, civilians) {
    const groups = new Map();
    for (const p of civilians) {
        const group = groups.get(p.home_id) || []; group.push(p); groups.set(p.home_id, group);
    }
    for (const local of groups.values()) {
        if (local.length < 2) continue;
        const required = local.length >= 5 ? ['farmer', 'lumberjack', 'miner', 'smith', 'builder']
            : local.length >= 3 ? ['farmer', 'lumberjack', 'miner'] : ['farmer', 'lumberjack'];
        const counts = new Map();
        for (const p of local) counts.set(p.job, (counts.get(p.job) || 0) + 1);
        for (const job of required) {
            if (counts.get(job)) continue;
            const person = local.find(p => !required.includes(p.job) || counts.get(p.job) > 1);
            if (!person) continue;
            counts.set(person.job, counts.get(person.job) - 1); counts.set(job, 1);
            person.job = job; delete person.work_target;
            if (person.daily_life) Object.assign(person.daily_life, { phase: 'return', site: null, timer: 0 });
        }
    }
}

// Keep an existing young household together, including dependent children.
// Unattached founders can still travel together and form families after arrival.
export function settler_cohort(world, kingdom_id, capacity = POPULATION.settlers) {
    const ready = p => p.health > 60 && !p.voyage_id && !p.prisoner_of && !justice_busy(world, p)
        && !p.medical_role && !p.recovering && p.role !== 'soldier'
        && (p.needs?.hydration ?? 85) > 55
        && !(world.remains || []).some(r => r.carrier_id === p.id)
        && !world.machines.some(m => m.crew_id === p.id);
    const residents = world.people.filter(p => p.village_id === kingdom_id);
    const adults = residents.filter(p => ready(p) && p.age / world.year_length >= 18
        && p.age / world.year_length <= POPULATION.settler_max_age)
        .sort((a, b) => a.age - b.age || a.id - b.id);
    const by_id = new Map(adults.map(p => [p.id, p]));
    const lineage = new Map(world.people.map(p => [p.id, p]));
    for (const p of adults) {
        const partner = by_id.get(p.partner_id);
        if (!partner || partner.partner_id !== p.id || partner.home_id !== p.home_id
            || related(p, partner, lineage)) continue;
        const children = residents.filter(c => c.home_id === p.home_id && c.age / world.year_length < 18
            && c.parents?.some(parent => parent.id === p.id || parent.id === partner.id));
        if (children.some(c => !ready(c)) || children.length + 2 > capacity) continue;
        const cohort = [p, partner, ...children];
        if (cohort.length === 2 && capacity >= 3) {
            const companion = adults.find(q => q.id !== p.id && q.id !== partner.id
                && q.home_id === p.home_id && !q.partner_id && !residents.some(c =>
                    c.age / world.year_length < 18 && c.parents?.some(parent => parent.id === q.id)));
            if (companion) cohort.push(companion);
        }
        return cohort;
    }
    for (const p of adults.filter(p => !p.partner_id)) {
        const singles = adults.filter(q => q.home_id === p.home_id && !q.partner_id
            && !residents.some(c => c.age / world.year_length < 18 && c.parents?.some(parent => parent.id === q.id)));
        const partner = singles.find(q => q.id !== p.id && !related(p, q, lineage));
        if (partner && capacity >= 2) {
            const cohort = [p, partner];
            const third = singles.find(q => !cohort.includes(q));
            if (third && capacity >= 3) cohort.push(third);
            return cohort;
        }
    }
    return [];
}

export function advance_births(world, kingdom, sites, population, home_populations = null) {
    const delay = POPULATION[`${kingdom.race}_birth_seconds`] || POPULATION.birth_seconds;
    const counts = home_populations || new Map();
    if (!home_populations) for (const p of world.people) if (p.health > 0 && !p.voyage_id && !p.prisoner_of) {
        const home = p.home_id || p.village_id; counts.set(home, (counts.get(home) || 0) + 1);
    }
    for (const site of sites) {
        if (site.birth_timer <= delay || kingdom.food <= food_reserve(population) + 5
            || world.people.length >= world.max_people) continue;
        const local = counts.get(site.id) || 0;
        if (local < 2 || local >= site.houses.length * 5) continue;
        site.birth_timer = 0;
        const parents = select_parents(world, kingdom.id, site.id);
        const point = parents && world.land_near(site.x, site.y, 4);
        if (!point || !world.add_person(point.x, point.y, kingdom.id, kingdom.race, true)) continue;
        const child = world.people.at(-1); child.home_id = site.id; child.age = 0;
        initialize_child(child, parents, kingdom, () => world.random(), world.year);
        kingdom.food -= 5;
    }
}
