import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T, HEIGHT } from '../src/simulation.js';
import { find_path } from '../src/pathfinding.js';

test('A* and actual marching route around a long mountain wall', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS);
    for (let y = 20; y < 60; y++) world.set_tile(40, y, T.MOUNTAIN);
    const start = { id: 99, x: 35.5, y: 40.5, dx: 0, dy: 0 };
    const target = { x: 45.5, y: 40.5, route: true };
    const path = find_path(world, start, target);
    assert.ok(path.length > 40);
    assert.ok(path.every(point => world.walkable(point.x, point.y)));
    for (let step = 0; step < 500; step++) world.march(start, target, 0.125, 1.5);
    assert.ok(Math.hypot(start.x - target.x, start.y - target.y) < 1);
});

test('unreachable water-separated destinations do not produce a land route', () => {
    const world = new World({ preset: 'empty', inhabited: false });
    world.tiles.fill(T.GRASS);
    for (let y = 0; y < HEIGHT; y++) world.set_tile(40, y, T.OCEAN);
    assert.deepEqual(find_path(world, { x: 35, y: 40 }, { x: 45, y: 40 }), []);
});
