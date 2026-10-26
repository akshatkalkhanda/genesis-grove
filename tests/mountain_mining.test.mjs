import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { deposit_at, extract_mineral, MINING, mining_site } from '../src/mining.js';
import { initialize_daily_life } from '../src/daily_life.js';

function mining_town(seed = 'mountain-mining') {
    const world = new World({ preset: 'empty', inhabited: false, seed });
    world.tiles.fill(T.GRASS);
    const kingdom = world.found_village(50, 50);
    world.add_person(52, 50, kingdom.id);
    const miner = world.people.at(-1);
    miner.x = 52.5; miner.y = 50.5; miner.job = 'miner';
    return { world, kingdom, miner };
}

test('mountains remain impassable but can hold owned finite surface ore with a reachable mining foot', () => {
    const { world, kingdom, miner } = mining_town();
    const ore = world.index(53, 50);
    world.set_tile(53, 50, T.MOUNTAIN);
    world.ores[ore] = 1;
    assert.equal(world.walkable(53, 50), false);
    assert.equal(world.territory_at(53, 50), kingdom.id,
        'owned mountain territory is available for resource ownership');
    const rng = world.rng;
    const site = mining_site(world, miner, kingdom, kingdom);
    assert.ok(site);
    assert.equal(site.kind, 'mine');
    assert.equal(site.ore_x, 53); assert.equal(site.ore_y, 50);
    assert.equal(world.walkable(site.x, site.y), true, 'the worker stands beside the impassable ore tile');
    assert.equal(world.territory_at(site.x, site.y), kingdom.id);

    const result = extract_mineral(world, kingdom, site);
    assert.deepEqual(result, { material: 'copper', amount: MINING.yield, x: 53, y: 50 });
    assert.equal(kingdom.ore.copper, MINING.yield);
    assert.equal(world.ores[ore], 0, 'surface ore is depleted exactly once');
    assert.equal(world.strata[ore], 1);
    assert.equal(extract_mineral(world, kingdom, site), null, 'a depleted surface vein cannot be credited twice');
    assert.equal(kingdom.ore.copper, MINING.yield);
    assert.equal(world.rng, rng, 'site selection and extraction do not draw random veins');
});

test('deep seams are technology-gated, deterministic, and stop after three finite strata', () => {
    const { world, kingdom, miner } = mining_town('deep-seam-gates');
    const ore = world.index(53, 50);
    world.set_tile(53, 50, T.MOUNTAIN);
    assert.equal(world.ores[ore], 0);
    assert.equal(deposit_at(world, 53, 50, MINING.underground_level - 1), 0);
    kingdom.research_level = MINING.underground_level;
    const rng = world.rng;
    for (let layer = 0; layer < MINING.max_strata; layer++) {
        const mineral = deposit_at(world, 53, 50, kingdom.research_level);
        assert.ok(mineral >= 1 && mineral <= 4);
        assert.equal(deposit_at(world, 53, 50, kingdom.research_level), mineral,
            'the same depleted layer resolves to the same deterministic seam');
        const site = { kind: 'mine', x: 52.5, y: 50.5, ore_x: 53, ore_y: 50 };
        assert.ok(extract_mineral(world, kingdom, site));
        assert.equal(world.strata[ore], layer + 1);
        assert.equal(world.ores[ore], 0);
    }
    assert.equal(deposit_at(world, 53, 50, kingdom.research_level), 0,
        'no further underground deposit appears after three worked seams');
    assert.equal(extract_mineral(world, kingdom,
        { kind: 'mine', x: 52.5, y: 50.5, ore_x: 53, ore_y: 50 }), null);
    assert.equal(world.rng, rng);
    assert.ok(world.people.some(p => p.id === miner.id));
});

test('world production extracts ore only from an adult miner actively working at the mine', () => {
    const { world, kingdom, miner } = mining_town('staffed-mine-production');
    const ore = world.index(53, 50);
    world.set_tile(53, 50, T.MOUNTAIN); world.ores[ore] = 1;
    const site = { kind: 'mine', x: 52.5, y: 50.5, ore_x: 53, ore_y: 50 };
    miner.x = site.x; miner.y = site.y;
    miner.age = world.year_length * 24;
    miner.job = 'farmer';
    Object.assign(initialize_daily_life(miner), { phase: 'rest', timer: 0, energy: 100, site });
    for (let i = 0; i < 64; i++) world.step(0.125);
    assert.equal(world.ores[ore], 1, 'an idle citizen cannot produce ore from the global mine timer');
    assert.equal(kingdom.ore.copper, 0);

    miner.x = site.x; miner.y = site.y; miner.job = 'miner';
    Object.assign(initialize_daily_life(miner), { phase: 'work', timer: 0, energy: 100, site });
    for (let i = 0; i < 64; i++) world.step(0.125);
    assert.equal(world.ores[ore], 0, 'the active worker depletes the finite surface seam');
    assert.equal(kingdom.ore.copper, MINING.yield);
});

test('miners cannot work an unreachable mountain peak or another kingdom\'s vein', () => {
    const { world, kingdom, miner } = mining_town('blocked-mines');
    for (const [x, y] of [[54, 50], [53, 50], [55, 50], [54, 49], [54, 51]]) {
        world.set_tile(x, y, T.MOUNTAIN);
    }
    world.ores[world.index(54, 50)] = 1;
    assert.equal(world.territory_at(54, 50), kingdom.id);
    assert.equal(mining_site(world, miner, kingdom, kingdom), null,
        'a deposit with no walkable neighboring foot cannot be assigned');

    const other = new World({ preset: 'empty', inhabited: false, seed: 'foreign-mountain' });
    other.tiles.fill(T.GRASS);
    const own = other.found_village(50, 50);
    other.found_village(56, 50);
    other.add_person(52, 50, own.id);
    const worker = other.people.at(-1); worker.x = 52.5; worker.y = 50.5;
    other.set_tile(55, 50, T.MOUNTAIN);
    other.ores[other.index(55, 50)] = 1;
    assert.equal(other.territory_at(55, 50), other.villages[1].id);
    assert.equal(mining_site(other, worker, own, own), null,
        'ore owned by a neighboring kingdom is skipped');
    const forged = { kind: 'mine', x: 54.5, y: 50.5, ore_x: 55, ore_y: 50 };
    assert.equal(extract_mineral(other, own, forged), null);
    assert.equal(other.ores[other.index(55, 50)], 1);
    assert.equal(own.ore.copper, 0);
});

test('a mining site on a separated owned island is not reachable across the sea', () => {
    const { world, kingdom, miner } = mining_town('island-mine-route');
    for (let y = 0; y < 128; y++) world.set_tile(55, y, T.OCEAN);
    const colony = world.found_colony(kingdom.id, 60, 50);
    assert.ok(colony);
    const ore = world.index(62, 50);
    world.set_tile(62, 50, T.MOUNTAIN);
    world.ores[ore] = 1;
    assert.equal(world.territory_at(62, 50), kingdom.id, 'the remote mountain belongs to the colony');
    assert.equal(mining_site(world, miner, colony, kingdom), null,
        'the worker cannot mine an island vein across an ocean barrier');
});
