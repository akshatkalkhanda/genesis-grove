import { develop_creature } from './creatures.js';

export const MAX_BUILDINGS = 64;
export const farm_target = population => Math.min(32, Math.max(1, Math.ceil(population / 20)));
export const food_reserve = population => Math.max(8, population * 4);
export const CIVIC_TYPES = new Set(['well', 'granary', 'school', 'church', 'temple', 'market']);
export const CIVIC_DESCRIPTIONS = Object.freeze({
    well: 'Waters nearby farms and helps extinguish nearby fires.',
    granary: 'Stores surplus grain and releases it when shared food runs low.',
    school: 'Children attend lessons and gain experience before adulthood.',
    church: 'A place of worship that improves nearby rest and social recovery.',
    temple: 'A sanctuary that improves nearby rest and social recovery.',
    market: 'Organized trade reduces journey times for supply shipments.'
});

export function advance_civic(world, kingdom, residents, dt) {
    const buildings = kingdom.buildings || [];
    const population = residents.length;
    const granary = buildings.find(b => b.type === 'granary');
    if (granary) {
        granary.stock ||= 0;
        const withdrawal = Math.min(granary.stock, Math.max(0, population * 2 - kingdom.food), dt * 4);
        kingdom.food += withdrawal; granary.stock -= withdrawal;
        const deposit = Math.min(Math.max(0, kingdom.food - food_reserve(population)),
            Math.max(0, 120 - granary.stock), dt * 2);
        kingdom.food -= deposit; granary.stock += deposit;
    }
    for (const building of buildings) {
        if (building.type === 'well') {
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                const x = Math.floor(building.x) + dx, y = Math.floor(building.y) + dy;
                if (!world.inside(x, y)) continue;
                const i = world.index(x, y);
                world.fire[i] = Math.max(0, world.fire[i] - dt * 2);
            }
        }
    }
    const schools = buildings.filter(b => b.type === 'school');
    const sanctuaries = buildings.filter(b => ['church', 'temple'].includes(b.type));
    for (const person of residents) {
        if (person.prisoner_of || person.voyage_id || person.health <= 0 || person.recovering) continue;
        if (person.age / world.year_length < 18 && person.daily_life?.phase === 'work'
            && schools.some(b => Math.hypot(b.x - person.x, b.y - person.y) < 2)
            && kingdom.food >= dt * 0.02) {
            kingdom.food -= dt * 0.02;
            develop_creature(person, 0, world.year_length, dt * 0.5);
        }
        if (['rest', 'social'].includes(person.daily_life?.phase)
            && sanctuaries.some(b => Math.hypot(b.x - person.x, b.y - person.y) < 6)) {
            person.daily_life.energy = Math.min(100, person.daily_life.energy + dt * 2);
        }
    }
}
