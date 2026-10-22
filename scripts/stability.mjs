import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { World } from '../src/simulation.js';

// Replay a copy of an exported save without opening or modifying the game profile.
const [input, years_text = '500', output = 'artifacts/stability/replay.json'] = process.argv.slice(2);
const years = Number(years_text);
if (!input || !Number.isInteger(years) || years < 1 || years > 10000) {
    throw new Error('Usage: node scripts/stability.mjs exported-world.json [years:1..10000] [report.json]');
}
if (path.resolve(input) === path.resolve(output)
    || (fs.existsSync(output) && fs.realpathSync(input) === fs.realpathSync(output))) {
    throw new Error('Report must not overwrite the input world.');
}
const bytes = fs.readFileSync(input);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const world = World.deserialize(JSON.parse(bytes));
const start = world.year, target = start + years;
const initial = world.people.filter(person => person.health > 0).length;
const seen = new Set(world.people.map(person => person.id)), dead = new Set();
const initial_seen = seen.size;
const initially_dead = new Set(world.people.filter(person => person.health <= 0).map(person => person.id));
const causes = {}, weather_events = {}, samples = [];
const record_death = person => {
    if (dead.has(person.id) || initially_dead.has(person.id)) return;
    dead.add(person.id);
    const cause = person.health_history?.at(-1)?.cause || person.death_cause || 'unclassified';
    causes[cause] = (causes[cause] || 0) + 1;
};
const clean_up = world.clean_up.bind(world);
world.clean_up = () => {
    const before = [...world.people]; clean_up();
    const remaining = new Set(world.people.map(person => person.id));
    for (const person of before) if (!remaining.has(person.id)) record_death(person);
};
const log = world.log.bind(world);
world.log = (text, kind, location) => {
    const weather = text.match(/^(Rain cloud|Thunderstorm|Blizzard|Drought|Tsunami)\b/)?.[1];
    if (weather) weather_events[weather] = (weather_events[weather] || 0) + 1;
    return log(text, kind, location);
};
function sample() {
    const live = world.people.filter(person => person.health > 0);
    const restored = World.deserialize(world.serialize());
    const row = { year: world.year, population: live.length, births: seen.size - initial_seen,
        deaths: dead.size, children: live.filter(person => person.age / world.year_length < 18).length,
        food: Math.round(world.villages.reduce((total, village) => total + village.food, 0)),
        death_causes: { ...causes },
        roundtrip_population: restored.people.filter(person => person.health > 0).length };
    samples.push(row); console.log(JSON.stringify(row));
}
sample(); let next = start + 50;
while (world.year < target && world.people.some(person => person.health > 0)) {
    world.step(0.125);
    for (const person of world.people) {
        seen.add(person.id);
        if (person.health <= 0) record_death(person);
    }
    if (world.year >= next) { sample(); next += 50; }
}
if (samples.at(-1).year !== world.year) sample();
const report = { start, target, final_year: world.year, dt: 0.125, initial,
    source_sha256: digest(bytes), source_unchanged: digest(bytes) === digest(fs.readFileSync(input)),
    weather_events, samples };
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
