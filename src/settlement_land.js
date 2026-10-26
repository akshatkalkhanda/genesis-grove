import { find_path } from './pathfinding.js';

export const LAND_RULES = Object.freeze({ farm_radius: 12, service_radius: 10,
    work_radius: 12, mill_radius: 8, farm_min_fertility: 0.3, route_budget: 1024 });
const CROPLAND = new Set([3, 4, 9, 10, 12, 13, 15]);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const town_sites = (world, kingdom) => [kingdom, ...world.colonies.filter(c => c.kingdom_id === kingdom.id)];

export function land_route(world, from, to) {
    if (!world.walkable(from.x, from.y) || !world.walkable(to.x, to.y)) return false;
    return world.index(from.x, from.y) === world.index(to.x, to.y)
        || find_path(world, from, to, LAND_RULES.route_budget).length > 0;
}

export function owns_plot(world, kingdom_id, x, y, footprint = 1, claims = null) {
    claims ||= world.claim_sites();
    if (!world.walkable(x, y) || world.fire[world.index(x, y)] > 0
        || world.territory_at(x, y, claims) !== kingdom_id) return false;
    for (let dy = -footprint; dy <= footprint; dy++) for (let dx = -footprint; dx <= footprint; dx++) {
        const px = Math.floor(x) + dx, py = Math.floor(y) + dy;
        if (!world.inside(px, py)) return false;
        // Ports and other shore buildings may border water, but may not cover foreign land.
        if (world.tile(px, py) > 1 && world.territory_at(px, py, claims) !== kingdom_id) return false;
    }
    return true;
}

export function farm_soil(world, x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!world.inside(x + dx, y + dy) || !CROPLAND.has(world.tile(x + dx, y + dy))) return false;
    }
    return true;
}

export function farm_operational(world, kingdom, farm) {
    return farm_soil(world, farm.x, farm.y) && owns_plot(world, kingdom.id, farm.x, farm.y)
        && town_sites(world, kingdom).some(home => distance(home, farm) <= LAND_RULES.work_radius
            && land_route(world, home, farm));
}

export function local_mill(world, kingdom, farm) {
    return (kingdom.buildings || []).some(m => m.type === 'windmill'
        && owns_plot(world, kingdom.id, m.x, m.y) && distance(m, farm) <= LAND_RULES.mill_radius
        && land_route(world, farm, m));
}

export function local_farms(world, kingdom, home) {
    return (kingdom.buildings || []).filter(b => b.type === 'farm'
        && distance(home, b) <= LAND_RULES.work_radius && farm_operational(world, kingdom, b))
        .sort((a, b) => distance(home, a) - distance(home, b) || a.y - b.y || a.x - b.x);
}

export function construction_home(world, kingdom, type) {
    const homes = town_sites(world, kingdom);
    if (type === 'windmill') {
        const fields = (kingdom.buildings || []).filter(b => b.type === 'farm' && farm_operational(world, kingdom, b));
        return homes.slice().sort((a, b) =>
            fields.filter(f => distance(b, f) <= LAND_RULES.work_radius).length
            - fields.filter(f => distance(a, f) <= LAND_RULES.work_radius).length || a.id - b.id)[0] || kingdom;
    }
    if (type !== 'farm') return kingdom;
    return homes.map(home => ({ home,
        population: world.people.filter(p => p.health > 0 && p.village_id === kingdom.id
            && (p.home_id || p.village_id) === home.id).length,
        farms: (kingdom.buildings || []).filter(b => b.type === 'farm'
            && distance(home, b) <= LAND_RULES.work_radius && farm_operational(world, kingdom, b)).length }))
        .sort((a, b) => (Math.ceil(b.population / 20) - b.farms) - (Math.ceil(a.population / 20) - a.farms)
            || b.population - a.population || a.home.id - b.home.id)[0]?.home || kingdom;
}

export function find_building_plot(world, kingdom, type, origin = kingdom, ignore = null) {
    const radius = type === 'farm' ? LAND_RULES.farm_radius : type === 'well' ? 8 : LAND_RULES.service_radius;
    const claims = world.claim_sites(), homes = town_sites(world, kingdom);
    const structures = [...homes.flatMap(h => h.houses || []), ...(kingdom.buildings || []).filter(b => b !== ignore)];
    const candidates = [];
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius || dx * dx + dy * dy < (type === 'well' ? 2.25 : 9)) continue;
        const x = Math.floor(origin.x) + dx, y = Math.floor(origin.y) + dy;
        if (!owns_plot(world, kingdom.id, x, y, type === 'castle' ? 2 : type === 'well' ? 0 : 1, claims)) continue;
        if (type === 'farm' && (!farm_soil(world, x, y)
            || world.fertility[world.index(x, y)] < LAND_RULES.farm_min_fertility)) continue;
        const point = { x, y };
        if (structures.some(b => distance(b, point) < (type === 'castle' || b.type === 'castle' ? 5 : type === 'well' ? 1.5 : 3))
            || world.cemeteries.some(c => distance(c, point) < 4)) continue;
        if (type === 'windmill' && !(kingdom.buildings || []).some(b => b.type === 'farm'
            && b !== ignore && distance(b, point) <= LAND_RULES.mill_radius && farm_operational(world, kingdom, b))) continue;
        if (type === 'dock' && ![[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]
            .some(([ox, oy]) => world.inside(x + ox, y + oy) && world.tile(x + ox, y + oy) <= 1)) continue;
        candidates.push(point);
    }
    candidates.sort((a, b) => distance(origin, a) - distance(origin, b)
        || (type === 'farm' ? world.fertility[world.index(b.x, b.y)] - world.fertility[world.index(a.x, a.y)] : 0)
        || a.y - b.y || a.x - b.x);
    return candidates.slice(0, 32).find(p => land_route(world, origin, p)) || null;
}

// One-time coordinate repair for pre-rule saves. No RNG or saved supplies are consumed.
export function migrate_farmland(world) {
    for (const kingdom of world.villages) {
        const homes = town_sites(world, kingdom);
        const legacy = (kingdom.buildings || []).filter(b => ['farm', 'windmill'].includes(b.type))
            .sort((a, b) => Number(a.type === 'windmill') - Number(b.type === 'windmill'));
        for (const b of legacy) {
            const home = homes.slice().sort((a, c) => distance(a, b) - distance(c, b) || a.id - c.id)[0];
            const owner = world.territory_at(b.x, b.y);
            const invalid = b.type === 'farm' ? !farm_operational(world, kingdom, b)
                : !(kingdom.buildings || []).some(f => f.type === 'farm' && farm_operational(world, kingdom, f)
                    && distance(f, b) <= LAND_RULES.mill_radius);
            if (owner === null || owner === kingdom.id && invalid) {
                const point = find_building_plot(world, kingdom, b.type, b.type === 'windmill' ? construction_home(world, kingdom, b.type) : home, b);
                if (point) { b.x = point.x; b.y = point.y; world.revision++; }
            }
            b.home_id = home.id;
        }
    }
}

export function valid_land(data) {
    if (data.land_rules !== undefined && data.land_rules !== 1) return false;
    return data.villages.every(k => (k.buildings || []).every(b => b.home_id === undefined
        || Number.isSafeInteger(b.home_id) && b.home_id > 0 && b.home_id < data.next_id));
}
