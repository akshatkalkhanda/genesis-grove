// Transient deterministic water routing. Neither inspection nor rebuilding these
// caches writes world/save state or consumes randomness. Work per rebuild is at
// most the map's cell count (24,576 on the current map), with 160 cached goals.
const CACHE_LIMIT = 160;
const caches = new WeakMap();
const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const center = (index, width) => ({ x: index % width + 0.5, y: Math.floor(index / width) + 0.5 });

function navigation(world) {
    let cache = caches.get(world);
    if (cache && cache.revision === world.navigation_revision && cache.tiles === world.tiles
        && cache.width === world.width) return cache;
    const width = world.width, size = world.tiles.length;
    const component = new Int32Array(size), queue = new Int32Array(size);
    let label = 0;
    for (let index = 0; index < size; index++) {
        if (component[index] || world.tiles[index] > 1) continue;
        component[index] = ++label;
        let head = 0, tail = 1; queue[0] = index;
        while (head < tail) {
            const at = queue[head++], x = at % width, y = Math.floor(at / width);
            for (const [dx, dy] of steps) {
                const nx = x + dx, ny = y + dy, next = ny * width + nx;
                if (nx < 0 || nx >= width || ny < 0 || next >= size
                    || component[next] || world.tiles[next] > 1) continue;
                component[next] = label; queue[tail++] = next;
            }
        }
    }
    cache = { revision: world.navigation_revision, tiles: world.tiles, width, component, fields: new Map() };
    caches.set(world, cache);
    return cache;
}

function flow(world, cache, goal) {
    if (cache.fields.has(goal)) return cache.fields.get(goal);
    const width = world.width, size = world.tiles.length;
    const next = new Int32Array(size).fill(-1), queue = new Int32Array(size);
    let head = 0, tail = 1; queue[0] = goal; next[goal] = goal;
    while (head < tail) {
        const at = queue[head++], x = at % width, y = Math.floor(at / width);
        for (const [dx, dy] of steps) {
            const nx = x + dx, ny = y + dy, neighbor = ny * width + nx;
            if (nx < 0 || nx >= width || ny < 0 || neighbor >= size
                || next[neighbor] !== -1 || world.tiles[neighbor] > 1) continue;
            next[neighbor] = at; queue[tail++] = neighbor;
        }
    }
    if (cache.fields.size >= CACHE_LIMIT) cache.fields.delete(cache.fields.keys().next().value);
    cache.fields.set(goal, next);
    return next;
}

// Retain dock/radius/scan priority, but reject isolated water on the wrong shore.
// Docks are live inputs, so moved/removed/new docks never reuse a stale destination.
export function water_return_plan(world, boat, docks) {
    if (!docks.length) return { harbor: null, waypoint: null, status: 'no_dock' };
    const cache = navigation(world), width = world.width;
    const origin = world.index(boat.x, boat.y), mass = cache.component[origin];
    if (!world.inside(boat.x, boat.y) || !mass) return { harbor: null, waypoint: null, status: 'not_water' };
    let found_water = false, goal = -1;
    for (const dock of docks) {
        for (let radius = 1; radius <= 4 && goal < 0; radius++) {
            for (let dy = -radius; dy <= radius && goal < 0; dy++) for (let dx = -radius; dx <= radius; dx++) {
                const x = dock.x + dx, y = dock.y + dy;
                if (!world.inside(x, y) || world.tile(x, y) > 1) continue;
                found_water = true;
                const index = world.index(x, y);
                if (cache.component[index] === mass) { goal = index; break; }
            }
        }
        if (goal >= 0) break;
    }
    if (goal < 0) return { harbor: null, waypoint: null, status: found_water ? 'unreachable' : 'no_harbor' };
    const harbor = center(goal, width), here = center(origin, width);
    const next = center(flow(world, cache, goal)[origin], width);
    // Reach a tile's center before turning. This prevents diagonal corner cutting
    // and makes the route depend only on saved position, even after cache rebuild.
    const ox = boat.x - here.x, oy = boat.y - here.y;
    const dx = next.x - here.x, dy = next.y - here.y;
    const aligned = Math.abs(ox * dy - oy * dx) <= 1e-8 && ox * dx + oy * dy > 0;
    const waypoint = Math.hypot(ox, oy) <= 1e-8 || aligned ? next : here;
    return { harbor, waypoint, status: 'reachable' };
}

// Traverse every crossed cell, including both neighbors at a diagonal corner.
export function water_segment(world, from, to) {
    if (!world.inside(from.x, from.y) || !world.inside(to.x, to.y)) return false;
    let x = Math.floor(from.x), y = Math.floor(from.y);
    const tx = Math.floor(to.x), ty = Math.floor(to.y);
    const dx = to.x - from.x, dy = to.y - from.y;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const delta_x = dx ? Math.abs(1 / dx) : Infinity;
    const delta_y = dy ? Math.abs(1 / dy) : Infinity;
    let cross_x = dx ? (sx > 0 ? x + 1 - from.x : from.x - x) * delta_x : Infinity;
    let cross_y = dy ? (sy > 0 ? y + 1 - from.y : from.y - y) * delta_y : Infinity;
    for (let step = 0; step <= world.tiles.length; step++) {
        if (world.tile(x, y) > 1) return false;
        if (x === tx && y === ty) return true;
        if (Math.abs(cross_x - cross_y) <= 1e-12) {
            if (world.tile(x + sx, y) > 1 || world.tile(x, y + sy) > 1) return false;
            x += sx; y += sy; cross_x += delta_x; cross_y += delta_y;
        } else if (cross_x < cross_y) { x += sx; cross_x += delta_x; }
        else { y += sy; cross_y += delta_y; }
    }
    return false;
}
