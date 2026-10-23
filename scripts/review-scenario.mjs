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
const samples = [];
const sample = () => ({ year: world.year, population: world.people.length,
    children: world.people.filter(p => p.age / world.year_length < 18).length,
    kingdoms: world.villages.filter(k => k.alive).length,
    food: world.villages.reduce((sum, k) => sum + k.food, 0),
    food_per_person: world.villages.reduce((sum, k) => sum + k.food, 0) / Math.max(1, world.people.length),
    wildlife: world.animals.length, starvation_damage: world.people.reduce((sum, p) => sum
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
    final: sample(), save_roundtrip: true,
    limits: 'Single peaceful expanding seed; sampled living damage histories are not lifetime death accounting. The manually placed play-review storm is not replayed.' };
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.final));
