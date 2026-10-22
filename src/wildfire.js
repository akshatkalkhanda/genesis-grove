// Each ignition has a finite front. Children inherit the remaining distance;
// spreading never creates a fresh, unlimited ignition.
export const MAX_FIRE_SPREAD = 6;
export const FIRE_FUELS = new Set([3, 4, 9, 10, 12, 13, 15]);
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function ignite_fire(world, index, duration) {
    world.fire[index] = duration;
    world.fire_spread[index] = MAX_FIRE_SPREAD;
}

export function advance_fire(world, dt) {
    const pending = new Map();
    for (let i = 0; i < world.fire.length; i++) {
        if (world.fire[i] <= 0) { world.fire_spread[i] = -1; continue; }
        // Old saves stored heat alone. Give each existing fire one bounded front.
        if (world.fire_spread[i] < 0) world.fire_spread[i] = MAX_FIRE_SPREAD;
        world.fire[i] = Math.max(0, world.fire[i] - dt);
        if (!world.fire[i]) {
            world.fire_spread[i] = -1;
            world.set_tile(i % world.width, Math.floor(i / world.width), 8);
            continue;
        }
        if (world.fire_spread[i] <= 0 || world.random() >= dt * 0.25) continue;
        const [dx, dy] = DIRECTIONS[Math.floor(world.random() * DIRECTIONS.length)];
        const x = i % world.width + dx, y = Math.floor(i / world.width) + dy;
        if (!world.inside(x, y)) continue;
        const j = world.index(x, y);
        if (!FIRE_FUELS.has(world.tiles[j]) || world.fire[j] > 0) continue;
        pending.set(j, Math.max(pending.get(j) ?? -1, world.fire_spread[i] - 1));
    }
    for (const [index, remaining] of pending) {
        world.fire[index] = 8 + world.random() * 8;
        world.fire_spread[index] = remaining;
    }
}
