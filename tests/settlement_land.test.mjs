import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { advance_buildings } from '../src/settlements.js';
import { LAND_RULES, farm_operational, farm_soil, find_building_plot, local_farms, local_mill,
    migrate_farmland, owns_plot, valid_land } from '../src/settlement_land.js';

function town(seed = 'owned-settlement-land') {
    const world = new World({ preset: 'empty', inhabited: false, seed });
    world.tiles.fill(T.GRASS);
    world.fertility.fill(0.8);
    return { world, kingdom: world.found_village(50, 50) };
}

test('building footprints stay on owned, walkable, safe land and exclude foreign neighbors', () => {
    const { world, kingdom } = town();
    const enemy = world.found_village(56, 50);
    assert.equal(owns_plot(world, kingdom.id, 53, 50, 0), true,
        'the plot center is owned by the first kingdom at the shared boundary');
    assert.equal(owns_plot(world, kingdom.id, 53, 50, 1), false,
        'a footprint crossing into the enemy claim is rejected');
    assert.equal(owns_plot(world, enemy.id, 57, 50), true);
    assert.equal(owns_plot(world, kingdom.id, 130, 50), false, 'unclaimed land is not buildable');

    world.set_tile(52, 50, T.MOUNTAIN);
    assert.equal(owns_plot(world, kingdom.id, 52, 50), false, 'impassable mountain cannot host a building');
    world.set_tile(51, 50, T.GRASS);
    world.fire[world.index(51, 50)] = 1;
    assert.equal(owns_plot(world, kingdom.id, 51, 50), false, 'an active fire makes the plot unsafe');
    assert.equal(owns_plot(world, kingdom.id, 0, 0, 1), false, 'the full footprint must remain inside the map');
});

test('farm placement chooses deterministic fertile owned cropland with a route from home', () => {
    const { world, kingdom } = town();
    world.set_tile(52, 50, T.SAND);
    world.set_tile(53, 50, T.MOUNTAIN);
    const before_rng = world.rng;
    const first = find_building_plot(world, kingdom, 'farm');
    const second = find_building_plot(world, kingdom, 'farm');
    assert.deepEqual(first, second, 'plot choice is stable and does not depend on random draws');
    assert.ok(first);
    assert.ok(Math.hypot(first.x - kingdom.x, first.y - kingdom.y) <= LAND_RULES.farm_radius);
    assert.ok(owns_plot(world, kingdom.id, first.x, first.y, 1));
    assert.ok(world.fertility[world.index(first.x, first.y)] >= LAND_RULES.farm_min_fertility);
    assert.ok([T.GRASS, T.FOREST, T.JUNGLE, T.SAVANNA, T.MAPLE, T.MUSHROOM, T.CELESTIAL]
        .includes(world.tile(first.x, first.y)));
    assert.equal(world.rng, before_rng);
});

test('a compact shore town can place a legal one-tile well where a farm footprint cannot fit', () => {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'compact-shore-well' });
    world.tiles.fill(T.OCEAN); world.fertility.fill(0.8);
    for (let y = 49; y <= 50; y++) for (let x = 43; x <= 57; x++) world.set_tile(x, y, T.GRASS);
    const kingdom = world.found_village(50, 50);

    const well = find_building_plot(world, kingdom, 'well');
    assert.ok(well, 'a narrow but owned shoreline still has a reachable well point');
    assert.ok(owns_plot(world, kingdom.id, well.x, well.y, 0));
    assert.ok(world.walkable(well.x, well.y));
    assert.equal(farm_soil(world, well.x, well.y), false,
        'the shoreline does not have the full 3×3 cultivated footprint a farm requires');
    assert.equal(find_building_plot(world, kingdom, 'farm'), null,
        'farm placement does not relax its footprint or soil requirements to fit the compact shore');
});

test('farms and windmills operate only on nearby owned cropland reached from a town', () => {
    const { world, kingdom } = town();
    const farm = { type: 'farm', x: 53, y: 50, growth: 0.6, harvests: 2, stock: 18 };
    const mill = { type: 'windmill', x: 57, y: 50, growth: 0, harvests: 0 };
    kingdom.buildings.push(farm, mill);
    assert.equal(farm_operational(world, kingdom, farm), true);
    assert.equal(local_mill(world, kingdom, farm), true);
    assert.deepEqual(local_farms(world, kingdom, kingdom).map(b => b.type), ['farm']);

    world.set_tile(farm.x, farm.y, T.SNOW);
    assert.equal(farm_operational(world, kingdom, farm), false, 'snowfield is not cultivable land');
    assert.equal(local_mill(world, kingdom, farm), true,
        'the local mill remains within range, while soil rules disable field output');
    world.set_tile(farm.x, farm.y, T.GRASS);
    mill.x = 62; mill.y = 50;
    assert.equal(local_mill(world, kingdom, farm), false, 'mills outside the local eight-tile service radius do not boost');

    mill.x = 57; mill.y = 50;
    for (let y = 0; y < world.tiles.length / world.width; y++) world.set_tile(51, y, T.MOUNTAIN);
    assert.equal(farm_operational(world, kingdom, farm), false,
        'nearby terrain alone does not make a field operational when no walking route connects it to home');
});

test('only an adult farmer physically working an owned field advances and harvests it', () => {
    const { world, kingdom } = town('staffed-field-output');
    const farm = { type: 'farm', x: 53, y: 50, growth: 0.99, harvests: 0, stock: 0 };
    kingdom.buildings.push(farm, { type: 'windmill', x: 56, y: 50, growth: 0, harvests: 0 });
    world.add_person(53, 50, kingdom.id);
    const farmer = world.people.at(-1);
    farmer.age = world.year_length * 24;
    farmer.job = 'farmer'; farmer.x = 53.5; farmer.y = 50.5;
    farmer.daily_life = { phase: 'work', timer: 0, energy: 80,
        site: { kind: 'farm', x: farm.x, y: farm.y }, cargo: { food: 0, wood: 0 } };
    const before = kingdom.food;
    advance_buildings(world, kingdom, 1, 20, 2);
    assert.equal(farm.harvests, 1);
    assert.equal(farm.growth, 0);
    assert.equal(kingdom.food - before + farm.stock, 160,
        'a nearby operational mill boosts the completed harvest');

    farm.growth = 0.5;
    farmer.daily_life.phase = 'travel';
    advance_buildings(world, kingdom, 5, 20, 2);
    assert.equal(farm.growth, 0.5, 'an unstaffed field does not grow from a remote worker');
});

test('legacy unclaimed farms migrate once without changing stocks, growth, or random state', () => {
    const { world, kingdom } = town('legacy-farm-placement');
    const farm = { type: 'farm', x: 110, y: 90, growth: 0.63, harvests: 7, stock: 29 };
    const mill = { type: 'windmill', x: 114, y: 90, growth: 0.3, harvests: 4, stock: 6 };
    kingdom.buildings.push(farm, mill);
    const rng = world.rng;
    migrate_farmland(world);
    const moved = { farm: { x: farm.x, y: farm.y }, mill: { x: mill.x, y: mill.y } };
    assert.notDeepEqual(moved.farm, { x: 110, y: 90 });
    assert.equal(farm.home_id, kingdom.id);
    assert.equal(mill.home_id, kingdom.id);
    assert.ok(owns_plot(world, kingdom.id, farm.x, farm.y));
    assert.ok(owns_plot(world, kingdom.id, mill.x, mill.y));
    assert.equal(farm_operational(world, kingdom, farm), true);
    assert.equal(local_mill(world, kingdom, farm), true);
    assert.deepEqual([farm.growth, farm.harvests, farm.stock, mill.growth, mill.harvests, mill.stock],
        [0.63, 7, 29, 0.3, 4, 6]);
    assert.equal(world.rng, rng, 'migration is deterministic and does not consume simulation randomness');
    const snapshot = moved;
    migrate_farmland(world);
    assert.deepEqual({ farm: { x: farm.x, y: farm.y }, mill: { x: mill.x, y: mill.y } }, snapshot,
        'once claimed, migrated buildings do not move on a repeated pass');
    assert.equal(world.rng, rng);
});

test('farm ownership metadata accepts valid homes and rejects invalid rule versions or IDs', () => {
    const { world, kingdom } = town();
    kingdom.buildings.push({ type: 'farm', x: 52, y: 50, home_id: kingdom.id });
    const save = world.serialize();
    save.land_rules = 1;
    assert.equal(valid_land(save), true);
    assert.equal(valid_land({ ...save, land_rules: 2 }), false);
    const bad_home = structuredClone(save); bad_home.villages[0].buildings[0].home_id = bad_home.next_id;
    assert.equal(valid_land(bad_home), false);
});
