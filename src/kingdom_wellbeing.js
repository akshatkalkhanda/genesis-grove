import { creature_stats } from './creatures.js';

export const WELLBEING = Object.freeze({ beds_per_house: 5, happy_threshold: 65,
    food_weight: 40, housing_weight: 25, health_weight: 25, safety_weight: 10 });
const clamp = n => Math.max(0, Math.min(1, n));

// This is a read-only needs estimate, not an unmodeled mood or opinion poll.
export function kingdom_wellbeing(world, kingdom_id) {
    const kingdom = world.villages.find(v => v.id === kingdom_id);
    if (!kingdom) return null;
    const residents = world.people.filter(p => p.village_id === kingdom_id && p.health > 0);
    const sites = [kingdom, ...world.colonies.filter(c => c.kingdom_id === kingdom_id)];
    const housed = new Set();
    let beds = 0;
    for (const site of sites) {
        const capacity = (site.houses || []).filter(h => world.walkable(h.x, h.y)
            && world.fire[world.index(h.x, h.y)] < 5).length * WELLBEING.beds_per_house;
        beds += capacity;
        // Households have no individually assigned beds in the current simulation.
        residents.filter(p => (p.home_id || p.village_id) === site.id)
            .sort((a, b) => a.id - b.id).slice(0, capacity).forEach(p => housed.add(p.id));
    }
    const buildings = (kingdom.buildings || []).filter(b => world.walkable(b.x, b.y)
        && world.fire[world.index(b.x, b.y)] < 5);
    const count = type => buildings.filter(b => b.type === type).length;
    const children = residents.filter(p => p.age / world.year_length >= 6 && p.age / world.year_length < 18);
    const schools = buildings.filter(b => b.type === 'school');
    const attending = children.filter(p => p.daily_life?.phase === 'work'
        && p.daily_life.site?.kind === 'school'
        && schools.some(s => Math.hypot(p.x - s.x, p.y - s.y) < 2)).length;
    let total = 0, happy = 0, hungry = 0, sick = 0, injured = 0;
    for (const p of residents) {
        const health = clamp(p.health / creature_stats(p, world.year_length).max_health);
        const food = clamp((p.needs?.nutrition ?? 100) / 70);
        const exposed = p.health_history?.some(h => ['combat', 'fire', 'starvation'].includes(h.cause)
            && world.time - h.time < 10) || world.fire[world.index(p.x, p.y)] > 0;
        const score = food * WELLBEING.food_weight + (housed.has(p.id) ? WELLBEING.housing_weight : 0)
            + health * WELLBEING.health_weight + (exposed ? 0 : WELLBEING.safety_weight);
        total += score; if (score >= WELLBEING.happy_threshold) happy++;
        if ((p.needs?.nutrition ?? 100) < 40) hungry++;
        if (p.infection > 0) sick++;
        if (health < 0.75) injured++;
    }
    const percent = n => residents.length ? Math.round(n / residents.length * 100) : null;
    return { population: residents.length, happiness: residents.length ? Math.round(total / residents.length) : null,
        happy_percent: percent(happy), happy, beds, housed: housed.size,
        homeless: residents.length - housed.size, homeless_percent: percent(residents.length - housed.size),
        hungry, sick, injured, food: kingdom.food, wells: count('well'), schools: schools.length,
        school_age: children.length, attending, clinics: count('clinic'), hospitals: count('hospital'),
        medical_staff: residents.filter(p => p.medical_role && p.health > 0).length,
        prisons: count('prison'), prison_capacity: count('prison') ? 8 : 0,
        prisoners: world.people.filter(p => p.prisoner_of === kingdom_id && p.health > 0).length,
        garrisons: world.armies.filter(a => a.kingdom_id === kingdom_id).length,
        tax_rate: null, tax_collected: null, drinking_water: null, clothing: null,
        clean_air: null, police: null, advocates: null, courts: null };
}
