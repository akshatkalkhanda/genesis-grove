import { land_route } from './settlement_land.js';

export const MINING = Object.freeze({ search_radius: 12, underground_level: 3,
    max_strata: 3, minimum_work: 2, yield: 4, beetle_yield: 6 });
const NEIGHBORS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
const MATERIALS = ['', 'copper', 'tin', 'iron', 'coal', 'stardust'];

export function deposit_at(world, x, y, technology = 0) {
    if (!world.inside(x, y)) return 0;
    const i = world.index(x, y);
    if (world.ores[i]) return world.ores[i];
    if (technology < MINING.underground_level || world.strata[i] >= MINING.max_strata
        || ![5, 6, 14].includes(world.tiles[i])) return 0;
    return 1 + ((Math.imul(Math.floor(x) + 1, 73856093) ^ Math.imul(Math.floor(y) + 1, 19349663)
        ^ Math.imul(world.strata[i] + 1, 83492791)) >>> 0) % 4;
}

export function mine_resource(world, site, technology) {
    if (site.ore_x !== undefined) return deposit_at(world, site.ore_x, site.ore_y, technology)
        ? { x: site.ore_x, y: site.ore_y } : null;
    return NEIGHBORS.map(([dx, dy]) => ({ x: Math.floor(site.x) + dx, y: Math.floor(site.y) + dy }))
        .find(p => deposit_at(world, p.x, p.y, technology)) || null;
}

export function mining_site(world, person, home, kingdom) {
    const candidates = [], technology = kingdom.research_level || 0;
    const homes = [kingdom, ...world.colonies.filter(c => c.kingdom_id === kingdom.id)];
    const structures = [...homes, ...homes.flatMap(h => h.houses || []), ...(kingdom.buildings || []), ...world.cemeteries];
    const masses = world._army_masses_revision === world.navigation_revision ? world._army_masses : null;
    const mass = masses?.[world.index(person.x, person.y)];
    for (let dy = -MINING.search_radius; dy <= MINING.search_radius; dy++) {
        for (let dx = -MINING.search_radius; dx <= MINING.search_radius; dx++) {
            const x = Math.floor(home.x) + dx, y = Math.floor(home.y) + dy;
            if (dx * dx + dy * dy > MINING.search_radius ** 2 || !deposit_at(world, x, y, technology)
                || world.territory_at(x, y) !== kingdom.id) continue;
            for (const [ox, oy] of NEIGHBORS) {
                const fx = x + ox, fy = y + oy;
                if (!world.walkable(fx, fy) || world.fire[world.index(fx, fy)] > 0
                    || world.territory_at(fx, fy) !== kingdom.id
                    || (mass !== undefined && masses[world.index(fx, fy)] !== mass)
                    || structures.some(b => Math.hypot(b.x - fx - 0.5, b.y - fy - 0.5) < 1.25)) continue;
                candidates.push({ x: fx + 0.5, y: fy + 0.5, kind: 'mine', ore_x: x, ore_y: y });
            }
        }
    }
    candidates.sort((a, b) => Math.hypot(person.x - a.x, person.y - a.y)
        - Math.hypot(person.x - b.x, person.y - b.y) || a.ore_y - b.ore_y || a.ore_x - b.ore_x);
    return candidates.slice(0, 24).find(p => land_route(world, person, p)) || null;
}

export function extract_mineral(world, kingdom, site) {
    const point = mine_resource(world, site, kingdom.research_level || 0);
    if (!point || !world.walkable(site.x, site.y) || world.fire[world.index(site.x, site.y)] > 0
        || Math.abs(Math.floor(site.x) - point.x) + Math.abs(Math.floor(site.y) - point.y) > 1
        || world.territory_at(site.x, site.y) !== kingdom.id || world.territory_at(point.x, point.y) !== kingdom.id) return null;
    const i = world.index(point.x, point.y), ore = deposit_at(world, point.x, point.y, kingdom.research_level || 0);
    if (!ore) return null;
    const material = MATERIALS[ore], amount = kingdom.race === 'beetlefolk' ? MINING.beetle_yield : MINING.yield;
    kingdom.ore[material] += amount; world.ores[i] = 0;
    world.strata[i] = Math.min(MINING.max_strata, world.strata[i] + 1); world.revision++;
    world.effects.push({ type: 'mine', x: site.x, y: site.y, radius: 0.5, life: 1, duration: 0.5 });
    return { material, amount, x: point.x, y: point.y };
}
