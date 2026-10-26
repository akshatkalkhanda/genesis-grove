// Forest biomes and their six-pixel artwork share one harvestable tree anchor.
export const WOODED = new Set([4, 9, 12, 13, 15]);
export const FORESTRY = Object.freeze({ wood_per_fertility: 20, stump_seconds: 90,
    growth_seconds: 90, fertility_per_second: 0.004 });
export const TREE_BIOMES = Object.freeze({ 4: 'forest', 9: 'jungle', 12: 'maple',
    13: 'mushroom', 15: 'celestial' });
const clearings_cache = new WeakMap();

export function tree_clearings(world) {
    const cached = clearings_cache.get(world);
    if (cached?.revision === world.revision) return cached.cells;
    const cells = new Uint8Array(world.tiles.length);
    for (const site of [...world.villages.filter(v => v.alive), ...world.colonies]) {
        for (const place of [site, ...(site.houses || []), ...(site.buildings || [])]) {
            for (let dy = -3; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                if (world.inside(place.x + dx, place.y + dy)) cells[world.index(place.x + dx, place.y + dy)] = 1;
            }
        }
    }
    clearings_cache.set(world, { revision: world.revision, cells });
    return cells;
}

export function is_tree_site(world, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 1 || y < 2 || !world.inside(x + 1, y + 1) || x % 2 !== 1 || y % 2 !== 0) return false;
    const i = world.index(x, y), stride = world.index(0, 1);
    return WOODED.has(world.tiles[i]) && !tree_clearings(world)[i]
        && ![i, i - 1, i + 1, i - stride, i + stride].some(j => world.roads[j]);
}

export function tree_variation(x, y) {
    return ((Math.imul(x + 48, 374761393) ^ Math.imul(y + 20, 668265263)) >>> 0) / 4294967295;
}

function tree_effect(world, effect) {
    const active = world.effects.filter(e => e.type === 'tree_chop' || e.type === 'tree_fall');
    if (active.length >= 64) world.effects.splice(world.effects.indexOf(active[0]), 1);
    world.effects.push(effect);
}

export function fell_tree(world, x, y) {
    const i = world.index(x, y), biome = world.tiles[i];
    if (!WOODED.has(biome)) return false;
    world.tiles[i] = 3;
    world.stumps.set(i, { biome, age: 0 });
    world.revision++;
    const variation = tree_variation(Math.floor(x), Math.floor(y));
    tree_effect(world, { type: 'tree_fall', x: Math.floor(x) + Math.floor(variation * 5) / 6,
        y: Math.floor(y) + 0.5, variation, biome: TREE_BIOMES[biome],
        radius: 1, life: 1, duration: 1.2 });
    return true;
}

export function harvest_tree(world, x, y, requested) {
    if (!is_tree_site(world, x, y) || world.fire[world.index(x, y)] > 0
        || !Number.isFinite(requested) || requested <= 0) return 0;
    const i = world.index(x, y);
    const amount = Math.min(requested, world.fertility[i] * FORESTRY.wood_per_fertility);
    // Older saves can contain an already exhausted standing tree. Clear it
    // on the next real work visit, without awarding any extra wood.
    if (amount <= 0) { fell_tree(world, x, y); return 0; }
    world.fertility[i] = Math.max(0, world.fertility[i] - amount / FORESTRY.wood_per_fertility);
    if (world.fertility[i] <= 0.000001) {
        world.fertility[i] = 0;
        fell_tree(world, x, y);
    } else {
        tree_effect(world, { type: 'tree_chop', x: Math.floor(x) + 0.5,
            y: Math.floor(y) + 0.5, radius: 1, life: 1, duration: 0.45 });
    }
    return amount;
}

export function advance_forestry(world, dt) {
    if (!(dt > 0)) return;
    for (const [i, stump] of world.stumps) {
        if (world.tiles[i] !== 3 || tree_clearings(world)[i] || world.roads[i]) { world.stumps.delete(i); world.revision++; continue; }
        if (world.fire[i] > 0) continue;
        const stage = Math.floor(stump.age / FORESTRY.stump_seconds);
        stump.age += dt;
        world.fertility[i] = Math.min(1, world.fertility[i] + dt * FORESTRY.fertility_per_second);
        if (stump.age >= FORESTRY.stump_seconds + FORESTRY.growth_seconds) {
            world.tiles[i] = stump.biome; world.stumps.delete(i); world.revision++;
        } else if (Math.floor(stump.age / FORESTRY.stump_seconds) !== stage) world.revision++;
    }
}

export function valid_stumps(entries, size) {
    if (entries === undefined) return true;
    if (!Array.isArray(entries) || entries.length > size) return false;
    const seen = new Set();
    return entries.every(e => Array.isArray(e) && e.length === 3
        && Number.isInteger(e[0]) && e[0] >= 0 && e[0] < size && !seen.has(e[0]) && seen.add(e[0])
        && WOODED.has(e[1]) && Number.isFinite(e[2]) && e[2] >= 0
        && e[2] < FORESTRY.stump_seconds + FORESTRY.growth_seconds);
}
