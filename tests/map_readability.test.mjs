import test from 'node:test';
import assert from 'node:assert/strict';
import { home_populations, settlement_labels } from '../src/map_readability.js';

function fixture() {
    const villages = [{ id: 1, name: 'Capital', alive: true, x: 50, y: 50 },
        { id: 2, name: 'Abandoned kingdom', alive: false, x: 60, y: 50 }];
    const colonies = Array.from({ length: 20 }, (_, i) => ({ id: i + 3,
        kingdom_id: 1, name: `Outpost ${i}`, x: 50 + i % 5, y: 50 + Math.floor(i / 5) }));
    const people = [{ health: 100, village_id: 1, home_id: 1 },
        { health: 100, village_id: 1, home_id: 3 },
        { health: 100, village_id: 1, home_id: 4 },
        { health: 100, village_id: 2, home_id: 2 },
        { health: 0, village_id: 1, home_id: 5 },
        { health: 100, village_id: 1, home_id: 6, voyage_id: 99 }];
    return { villages, colonies, people };
}
const view = { zoom: 5.01, selected: 1, origin: { x: -1000, y: -1000 },
    scale: 5, width: 1366, height: 768 };
const measure = name => name.length * 7;

test('only inhabited settlements of living kingdoms receive labels', () => {
    const world = fixture(), before = structuredClone(world);
    const counts = home_populations(world);
    assert.equal(counts.has(5), false); assert.equal(counts.has(6), false);
    const labels = settlement_labels(world, view, counts, measure);
    assert.ok(labels.length > 0);
    assert.ok(labels.every(label => [1, 3, 4].includes(label.site.id)));
    assert.equal(labels[0].site.id, 1, 'selected capital has priority');
    assert.deepEqual(world, before, 'render planning cannot change simulation state');
});

test('dense town labels never overlap and stay inside the usable viewport', () => {
    const world = fixture();
    world.people.push(...world.colonies.map(c => ({ health: 100, home_id: c.id, village_id: 1 })));
    for (const zoom of [1, 3.5, 5.01, 12]) {
        const labels = settlement_labels(world, { ...view, zoom }, home_populations(world), measure);
        assert.ok(labels.length <= 10);
        if (zoom === 1) assert.ok(labels.every(label => label.capital));
        for (let i = 0; i < labels.length; i++) {
            const a = labels[i];
            assert.ok(a.x >= 6 && a.y >= 76 && a.x + a.width <= view.width - 6
                && a.y + a.height <= view.height - 60);
            for (const b of labels.slice(i + 1)) assert.ok(a.x + a.width + 8 <= b.x
                || b.x + b.width + 8 <= a.x || a.y + a.height + 8 <= b.y
                || b.y + b.height + 8 <= a.y);
        }
    }
});
