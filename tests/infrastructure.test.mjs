import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_roads, advance_transport } from '../src/infrastructure.js';

function town() {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    world.add_person(50, 50, kingdom.id);
    kingdom.wood = 1000; kingdom.food = 100;
    return { world, kingdom };
}

test('roads take a land detour, use timber, and improve movement', () => {
    const { world, kingdom } = town();
    kingdom.houses = [{ x: 60, y: 50 }, { x: 51, y: 50 }];
    for (let y = 45; y <= 55; y++) world.set_tile(55, y, T.MOUNTAIN);
    advance_roads(world, kingdom, 8, 7);
    assert.ok(world.roads.filter(Boolean).length > 20);
    assert.ok(kingdom.wood < 1000);
    for (let i = 0; i < world.roads.length; i++) {
        if (world.roads[i]) assert.equal(world.tiles[i], T.GRASS);
    }
    const walker = { x: 50.5, y: 50.5, dx: 1, dy: 0 };
    world.move(walker, 0.25, 2);
    assert.ok(Math.abs(walker.x - 51.225) < 1e-8);
    world.set_tile(50, 50, T.OCEAN);
    assert.equal(world.roads[world.index(50, 50)], 0);
});

test('a cart collects finite farm surplus and delivers it; later ages upgrade the fleet', () => {
    const { world, kingdom } = town();
    kingdom.research_level = 2;
    kingdom.buildings = [{ type: 'farm', x: 56, y: 50, growth: 0, harvests: 1, stock: 24 },
        { type: 'windmill', x: 53, y: 53, growth: 0, harvests: 0, stock: 0 }];
    kingdom.vehicle_timer = 24;
    for (let step = 0; step < 200; step++) advance_transport(world, 0.125, v => v.research_level);
    assert.equal(world.vehicles.length, 1);
    const cart = world.vehicles[0];
    assert.ok(cart.deliveries >= 1);
    assert.equal(kingdom.food + kingdom.buildings[0].stock + cart.cargo, 124);
    assert.equal(cart.kind, 'cart');
    kingdom.research_level = 8; kingdom.vehicle_timer = 24;
    kingdom.ore.iron = 10; kingdom.ore.coal = 10;
    advance_transport(world, 0.125, v => v.research_level);
    assert.equal(cart.kind, 'truck');
    assert.equal(kingdom.ore.iron, 8);
    const restored = World.deserialize(world.serialize());
    for (let step = 0; step < 50; step++) {
        advance_transport(world, 0.125, v => v.research_level);
        advance_transport(restored, 0.125, v => v.research_level);
    }
    assert.deepEqual(restored.serialize(), world.serialize());
});

test('legacy saves gain infrastructure and malformed road or vehicle data is rejected', () => {
    const { world } = town();
    const legacy = world.serialize(); delete legacy.roads; delete legacy.vehicles;
    assert.equal(World.deserialize(legacy).vehicles.length, 0);
    const corrupt = world.serialize(); corrupt.roads[0] = 4;
    assert.throws(() => World.deserialize(corrupt), /not a valid/);
    const bad_vehicle = world.serialize(); bad_vehicle.vehicles.push({ kind: 'truck' });
    assert.throws(() => World.deserialize(bad_vehicle), /not a valid/);
});
