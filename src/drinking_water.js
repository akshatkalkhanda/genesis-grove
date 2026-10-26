import { find_path } from './pathfinding.js';

export const WATER = Object.freeze({ initial_hydration: 85, thirst_rate: 0.8, thirsty: 55,
    critical: 15, drink_nutrition: 40, dehydration_per_second: 2, carry_capacity: 2,
    well_build_wood: 4, well_capacity: 60, well_initial: 30, well_recharge: 1, residents_per_well: 40, max_wells: 20, fetch_radius: 32,
    route_budget: 768, route_candidates: 8, min_lake_area: 4, max_lakes: 128,
    lake_per_tile: 4, lake_capacity: 120, lake_recharge: 0.02 });
const topology_cache = new WeakMap();
const well_cache = new WeakMap();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const usable = (world, p) => world.walkable(p.x, p.y) && !world.fire[world.index(p.x, p.y)];
const route = (world, from, to) => usable(world, from) && usable(world, to) && (world.index(from.x, from.y) === world.index(to.x, to.y)
    || find_path(world, from, to, WATER.route_budget).length > 0);

export function initialize_water(unit) {
    if (unit.species) return;
    unit.needs.hydration ??= WATER.initial_hydration;
    unit.water_carried ??= 0;
}

export function invalidate_water(world) { topology_cache.delete(world); }

// Water connected to a map edge is sea. Enclosed ponds are assumed fresh in this milestone.
// Only topology is cached; querying it never initializes or refills a saved water stock.
export function water_topology(world) {
    const old = topology_cache.get(world);
    if (old?.tiles === world.tiles && old.revision === world.navigation_revision) return old.lakes;
    const width = world.width, height = world.tiles.length / width;
    const seen = new Uint8Array(world.tiles.length), lakes = [];
    for (let i = 0; i < world.tiles.length; i++) {
        if (seen[i] || world.tiles[i] > 1) continue;
        const cells = [i], shores = new Set(); seen[i] = 1; let edge = false;
        for (let head = 0; head < cells.length; head++) {
            const index = cells[head], x = index % width, y = Math.floor(index / width);
            if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
            for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
                if (!world.inside(nx, ny)) continue;
                const n = world.index(nx, ny);
                if (world.tiles[n] <= 1) { if (!seen[n]) { seen[n] = 1; cells.push(n); } }
                else if (world.walkable(nx, ny)) shores.add(n);
            }
        }
        if (!edge && cells.length >= WATER.min_lake_area && shores.size) lakes.push({
            anchor: i, cells: new Set(cells), area: cells.length,
            capacity: Math.min(WATER.lake_capacity, cells.length * WATER.lake_per_tile),
            shores: [...shores].map(n => ({ x: n % width + 0.5, y: Math.floor(n / width) + 0.5 }))
        });
    }
    lakes.sort((a, b) => b.area - a.area || a.anchor - b.anchor);
    const result = lakes.slice(0, WATER.max_lakes).sort((a, b) => a.anchor - b.anchor);
    topology_cache.set(world, { tiles: world.tiles, revision: world.navigation_revision, lakes: result });
    return result;
}

function wells(world) {
    const arrays = world.villages.map(k => k.buildings || []);
    const counts = arrays.reduce((sum, a) => sum + a.length, 0);
    let cached = well_cache.get(world);
    if (!cached || cached.revision !== world.revision || cached.counts !== counts
        || arrays.length !== cached.arrays.length || arrays.some((a, i) => a !== cached.arrays[i])) {
        const entries = world.villages.flatMap(k => (k.buildings || []).filter(b => b.type === 'well')
            .map(building => ({ building, kingdom_id: k.id })));
        cached = { revision: world.revision, arrays, counts, entries }; well_cache.set(world, cached);
    }
    return cached.entries.filter(({ building }) => usable(world, building));
}

export function well_construction(world, kingdom) {
    const residents = world.people.filter(p => p.health > 0 && p.village_id === kingdom.id);
    const homes = [kingdom, ...world.colonies.filter(c => c.kingdom_id === kingdom.id)];
    const local_wells = (kingdom.buildings || []).filter(b => b.type === 'well' && usable(world, b));
    const candidates = homes.map(home => {
        const population = residents.filter(p => (p.home_id || p.village_id) === home.id).length;
        const mass = world._army_masses?.[world.index(home.x, home.y)];
        const supplied = local_wells.filter(b => distance(home, b) <= 12
            && (mass === undefined || world._army_masses[world.index(b.x, b.y)] === mass)).length;
        const target = population ? Math.max(1, Math.ceil(population / WATER.residents_per_well)) : 0;
        return { home, population, supplied, target };
    });
    const deficits = candidates.reduce((sum, c) => sum + Math.max(0, c.target - c.supplied), 0);
    const existing = (kingdom.buildings || []).filter(b => b.type === 'well').length;
    const limit = Math.min(WATER.max_wells, Math.max(1, existing + deficits));
    const origin = candidates.filter(c => c.population > 0).sort((a, b) =>
        Number((kingdom.wood >= WATER.well_build_wood || (b.home.well_kit || 0) >= WATER.well_build_wood))
        - Number((kingdom.wood >= WATER.well_build_wood || (a.home.well_kit || 0) >= WATER.well_build_wood))
        || Number(b.supplied === 0) - Number(a.supplied === 0)
        || (b.target - b.supplied) - (a.target - a.supplied) || b.population - a.population
        || a.home.id - b.home.id)[0];
    return { limit, origin: origin?.home || kingdom, unserved: !origin?.supplied,
        prepaid: (origin?.home.well_kit || 0) >= WATER.well_build_wood,
        houses: homes.flatMap(h => h.houses || []) };
}

export function initialize_water_world(world, fill_lakes = false) {
    const previous = world.water_sources || [];
    const topology = water_topology(world);
    world.water_sources = topology.map(lake => ({ anchor: lake.anchor,
        // On splits only the component retaining an old anchor retains that stock.
        // On merges stocks combine, capped by the new capacity; water is never copied.
        stock: fill_lakes ? lake.capacity : Math.min(lake.capacity,
            previous.filter(p => lake.cells.has(p.anchor)).reduce((sum, p) => sum + p.stock, 0)) }));
    for (const { building } of wells(world)) building.water_stock ??= WATER.well_initial;
    world._water_topology = topology;
}

export function advance_water(world, dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const topology = water_topology(world);
    if (world._water_topology !== topology) initialize_water_world(world);
    for (const { building } of wells(world)) {
        building.water_stock ??= WATER.well_initial;
        const drought = world.weather.some(e => e.kind === 'drought' && distance(e, building) <= e.radius);
        building.water_stock = Math.min(WATER.well_capacity,
            building.water_stock + dt * WATER.well_recharge * (drought ? 0.25 : 1));
    }
    for (const lake of topology) {
        const source = world.water_sources.find(p => p.anchor === lake.anchor);
        const point = { x: lake.anchor % world.width, y: Math.floor(lake.anchor / world.width) };
        const drought = world.weather.some(e => e.kind === 'drought' && distance(e, point) <= e.radius);
        const rain = world.weather.some(e => ['raincloud', 'storm'].includes(e.kind) && distance(e, point) <= e.radius);
        source.stock = Math.min(lake.capacity, source.stock + dt
            * (Math.min(0.6, lake.area * WATER.lake_recharge) * (drought ? 0.25 : 1) + (rain ? 1 : 0)));
    }
}

export function water_points(world, origin, radius = WATER.fetch_radius) {
    const points = wells(world).filter(({ building }) => distance(origin, building) <= radius)
        .map(({ building }) => ({ x: Math.floor(building.x) + 0.5, y: Math.floor(building.y) + 0.5, kind: 'well', source: building,
            stock_key: 'water_stock' }));
    const sources = new Map(world.water_sources.map(p => [p.anchor, p]));
    for (const lake of water_topology(world)) {
        const source = sources.get(lake.anchor);
        if (!source) continue;
        const shore = lake.shores.filter(p => usable(world, p) && distance(origin, p) <= radius)
            .sort((a, b) => distance(origin, a) - distance(origin, b)).slice(0, WATER.route_candidates);
        points.push(...shore.map(p => ({ ...p, kind: 'freshwater', source, stock_key: 'stock' })));
    }
    return points.sort((a, b) => distance(origin, a) - distance(origin, b));
}

function sip_effect(world, unit) {
    if (world && world.effects.filter(e => e.type === 'drink').length < 32) {
        world.effects.push({ type: 'drink', x: unit.x, y: unit.y, radius: 0.5, life: 1, duration: 0.5 });
    }
}

export function drink_carried(unit, world = null) {
    if (unit.water_carried < 1) return false;
    unit.water_carried--;
    sip_effect(world, unit);
    unit.needs.hydration = Math.min(100, unit.needs.hydration + WATER.drink_nutrition);
    return true;
}

function drink_source(world, unit, point, refill = true) {
    const stock = point.source[point.stock_key] ?? 0;
    if (stock < 1) return false;
    point.source[point.stock_key] = stock - 1;
    unit.needs.hydration = Math.min(100, unit.needs.hydration + WATER.drink_nutrition);
    if (refill) {
        const amount = Math.min(WATER.carry_capacity - unit.water_carried,
            Math.floor(Math.max(0, point.source[point.stock_key] - 1)));
        unit.water_carried += amount; point.source[point.stock_key] -= amount;
    }
    sip_effect(world, unit);
    return true;
}

export function water_intent(world, unit) {
    if (drink_carried(unit, world)) return { action: 'Drinking', reason: 'Consumed one carried water ration.', holding: true };
    const points = water_points(world, unit);
    const supplied = points.filter(p => (p.source[p.stock_key] ?? 0) >= 1);
    const candidate = (supplied.length ? supplied : points).slice(0, WATER.route_candidates)
        .find(p => route(world, unit, p));
    if (!candidate) return { action: 'Seeking water',
        reason: 'No reachable well or enclosed freshwater pond is nearby; seawater is not drinkable.', holding: true };
    if (distance(unit, candidate) <= 1.25 && drink_source(world, unit, candidate)) {
        return { action: 'Drinking', reason: `Drew finite water from ${candidate.kind === 'well' ? 'a well' : 'an inland pond'}.`, holding: true };
    }
    return { x: candidate.x, y: candidate.y, route: true,
        action: distance(unit, candidate) <= 1.25 ? 'Waiting for water' : 'Seeking water',
        reason: (candidate.source[candidate.stock_key] ?? 0) >= 1 ? 'Walking to a reachable drinking-water source.'
            : 'The reachable source is depleted; waiting for replenishment.',
        holding: distance(unit, candidate) <= 1.25 };
}

// Institutions can serve a ration from a connected nearby well. Boats are served
// only at their own dock, never by drawing remote water while at sea.
export function service_water(world, unit, kingdom) {
    if (drink_carried(unit, world)) return true;
    if (!kingdom || unit.voyage_id) return false;
    let point = unit.prisoner_of ? (kingdom.buildings || []).find(b => b.type === 'prison') : null;
    if (!point) {
        const machine = world._crew_assignments?.get(unit.id);
        if (!machine?.crew_aboard) return false;
        const port = machine.kind === 'boat' ? 'dock'
            : ['plane', 'balloon', 'airship'].includes(machine.kind) ? 'aerodrome' : 'workshop';
        point = (kingdom.buildings || []).find(b => b.type === port && distance(machine, b) <= 3);
    }
    if (!point || !usable(world, point)) return false;
    const source = water_points(world, point).filter(p => p.kind === 'well'
        && (p.source[p.stock_key] ?? 0) >= 1).slice(0, WATER.route_candidates)
        .find(p => route(world, point, p));
    return source ? drink_source(world, unit, source, !unit.prisoner_of) : false;
}

export function water_access(world, point) {
    const candidates = water_points(world, point);
    return candidates.slice(0, WATER.route_candidates).some(p => route(world, point, p));
}

export function freshwater_access(world, point) {
    const groups = new Map();
    for (const candidate of water_points(world, point).filter(p => p.kind === 'freshwater')) {
        const group = groups.get(candidate.source) || [];
        if (group.length < 2) group.push(candidate);
        groups.set(candidate.source, group);
    }
    return [...groups.entries()].slice(0, WATER.route_candidates)
        .filter(([, candidates]) => candidates.some(p => route(world, point, p))).map(([source]) => source);
}

export function valid_water(data, size) {
    if (data.water_sources !== undefined && (!Array.isArray(data.water_sources)
        || data.water_sources.length > WATER.max_lakes)) return false;
    const seen = new Set();
    for (const p of data.water_sources || []) {
        if (!p || !Number.isInteger(p.anchor) || p.anchor < 0 || p.anchor >= size || seen.has(p.anchor)
            || !Number.isFinite(p.stock) || p.stock < 0 || p.stock > WATER.lake_capacity) return false;
        seen.add(p.anchor);
    }
    if ([...(data.colonies || []), ...(data.voyages || [])].some(v => v.well_kit !== undefined
        && (!Number.isInteger(v.well_kit) || v.well_kit < 0 || v.well_kit > WATER.well_build_wood))) return false;
    return data.villages.every(k => (k.buildings || []).every(b => b.water_stock === undefined
        || b.type === 'well' && Number.isFinite(b.water_stock) && b.water_stock >= 0 && b.water_stock <= WATER.well_capacity));
}
