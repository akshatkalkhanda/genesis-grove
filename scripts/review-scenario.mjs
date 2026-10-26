import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Profile-free reproduction of the review seed. An optional source directory permits
// a before/after comparison without editing either world or importing private saves.
const [source = path.resolve('src'), output = 'artifacts/review-scenario.json', years_text = '100'] = process.argv.slice(2);
const years = Number(years_text);
if (!Number.isInteger(years) || years < 1 || years > 500) throw new Error('Years must be 1..500.');
const { World } = await import(pathToFileURL(path.join(path.resolve(source), 'simulation.js')).href);
const world = new World({ seed: 'review-20261023', preset: 'islands', inhabited: true });
world.laws.expansion = true; world.laws.natural_events = true;
world.laws.diplomacy = false; world.laws.rebellions = false;
const dehydration_deaths = new Set();
const dehydration_losses = [];
const original_cleanup = world.clean_up.bind(world);
world.clean_up = () => {
    for (const person of world.people) if (person.health <= 0
        && person.health_history?.[0]?.cause === 'dehydration' && !dehydration_deaths.has(person.id)) {
        dehydration_deaths.add(person.id);
        const kingdom = world.villages.find(k => k.id === person.village_id);
        const wells = (kingdom?.buildings || []).filter(b => b.type === 'well');
        const closest = wells.sort((a, b) => Math.hypot(a.x - person.x, a.y - person.y)
            - Math.hypot(b.x - person.x, b.y - person.y))[0];
        if (dehydration_losses.length < 100) dehydration_losses.push({ id: person.id, year: world.year,
            kingdom_id: person.village_id, home_id: person.home_id, x: person.x, y: person.y,
            task: person.task, nearest_well_distance: closest ? Math.hypot(closest.x - person.x, closest.y - person.y) : null,
            nearest_well_stock: closest?.water_stock ?? null });
    }
    original_cleanup();
};
const samples = [];
const sample = () => ({ year: world.year, population: world.people.length,
    children: world.people.filter(p => p.age / world.year_length < 18).length,
    kingdoms: world.villages.filter(k => k.alive).length,
    food: world.villages.reduce((sum, k) => sum + k.food, 0),
    food_per_person: world.villages.reduce((sum, k) => sum + k.food, 0) / Math.max(1, world.people.length),
    wildlife: world.animals.length,
    water_modeled: world.people.some(p => p.needs?.hydration !== undefined),
    thirsty: world.people.filter(p => p.needs?.hydration <= 55).length,
    severely_dehydrated: world.people.filter(p => p.needs?.hydration <= 15).length,
    mean_hydration: world.people.length ? world.people.reduce((sum, p) => sum + (p.needs?.hydration ?? 0), 0) / world.people.length : null,
    wells: world.villages.reduce((sum, k) => sum + (k.buildings || []).filter(b => b.type === 'well').length, 0),
    well_water: world.villages.reduce((sum, k) => sum + (k.buildings || []).reduce((n, b) => n + (b.type === 'well' ? b.water_stock || 0 : 0), 0), 0),
    deaths_last_caused_by_dehydration: dehydration_deaths.size,
    starvation_damage: world.people.reduce((sum, p) => sum
        + (p.health_history || []).filter(h => h.cause === 'starvation').reduce((s, h) => s + h.amount, 0), 0) });
samples.push(sample());
let next = 10;
while (world.year < years + 1) {
    world.step(0.125);
    if (world.year >= next) { samples.push(sample()); next += 10; }
}
const save = world.serialize();
const restored = World.deserialize(save);
if (JSON.stringify(restored.serialize()) !== JSON.stringify(save)) throw new Error('Final save differs after roundtrip.');
const report = { seed: world.seed, source: path.resolve(source), years, samples,
    final: sample(), dehydration_losses, save_roundtrip: true,
    limits: 'Single peaceful expanding seed; sampled living damage histories are not lifetime death accounting. Dehydration death counts observe the last recorded damage cause at cleanup, not every contributing cause. The manually placed play-review storm is not replayed.' };
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
fs.writeFileSync(output.replace(/\.json$/, '') + '-world.json', JSON.stringify(save));
console.log(JSON.stringify(report.final));
