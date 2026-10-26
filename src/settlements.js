import { WATER, well_construction } from './drinking_water.js';
import { find_path } from './pathfinding.js';
import { MAX_BUILDINGS, farm_target, food_reserve } from './civic.js';

export const BUILDINGS = Object.freeze({
    farm: { label: 'Farm', population: 6, age: 0, wood: 8 },
    well: { label: 'Well', population: 1, age: 0, wood: WATER.well_build_wood },
    granary: { label: 'Granary', population: 8, age: 0, wood: 12 },
    clinic: { label: 'Clinic', population: 8, age: 0, wood: 12 },
    school: { label: 'School', population: 12, age: 0, wood: 18 },
    church: { label: 'Church', population: 18, age: 1, wood: 22 },
    temple: { label: 'Temple', population: 24, age: 2, wood: 26 },
    market: { label: 'Market', population: 16, age: 1, wood: 20 },
    hospital: { label: 'Hospital', population: 30, age: 5, wood: 36 },
    windmill: { label: 'Windmill', population: 12, age: 1, wood: 18 },
    armory: { label: 'Armory', population: 16, age: 2, wood: 22 },
    camp: { label: 'Training camp', population: 10, age: 0, wood: 14 },
    monument: { label: 'Founders monument', population: 20, age: 4, wood: 36 },
    university: { label: 'University', population: 18, age: 5, wood: 30 },
    workshop: { label: 'Workshop', population: 20, age: 5, wood: 28 },
    factory: { label: 'Factory', population: 25, age: 7, wood: 44 },
    observatory: { label: 'Observatory', population: 24, age: 8, wood: 48 },
    astral_forge: { label: 'Astral forge', population: 24, age: 9, wood: 52 },
    stargate: { label: 'Stargate monument', population: 28, age: 11, wood: 60 },
    condenser: { label: 'Cosmic dust condenser', population: 28, age: 12, wood: 64 },
    watchtower: { label: 'Watchtower', population: 10, age: 1, wood: 20 },
    prison: { label: 'Prison', population: 16, age: 3, wood: 28 },
    castle: { label: 'Castle', population: 24, age: 4, wood: 60 },
    dock: { label: 'Dock', population: 12, age: 2, wood: 26 },
    aerodrome: { label: 'Aerodrome', population: 24, age: 7, wood: 44 }
});

export function advance_buildings(world, kingdom, dt, population, age) {
    kingdom.buildings ||= [];
    kingdom.build_timer = Math.min(60, (kingdom.build_timer || 0) + dt);
    const buildings = kingdom.buildings;
    const mill = buildings.some(building => building.type === 'windmill');
    const farmers = world.people.filter(p => p.village_id === kingdom.id && p.job === 'farmer'
        && p.role !== 'soldier' && !world._crew_assignments?.has(p.id) && !p.medical_role && !p.recovering && !p.prisoner_of
        && !world._funeral_assignments?.has(p.id) && !p.voyage_id && p.health > 0 && p.age / world.year_length >= 18).length;
    let staffed = farmers;
    const dust_rate = buildings.reduce((rate, building) => rate
        + ({ observatory: 1, stargate: 3, condenser: 8 }[building.type] || 0), 0);
    if (dust_rate) kingdom.ore.stardust = Math.min(1e6, (kingdom.ore.stardust || 0)
        + dt / world.year_length * dust_rate);
    for (const building of buildings) {
        if (building.type !== 'farm') continue;
        if (staffed-- <= 0 || world.fire[world.index(building.x, building.y)] > 0) continue;
        building.growth = Math.min(1, building.growth + dt / 30);
        if (building.growth >= 1) {
            const watered = buildings.some(b => b.type === 'well'
                && Math.hypot(b.x - building.x, b.y - building.y) <= 8);
            const yield_food = (mill ? 160 : 120) * (watered ? 1.1 : 1);
            const surplus = Math.min(12, 120 - (building.stock || 0));
            kingdom.food += yield_food - surplus;
            building.stock = (building.stock || 0) + surplus;
            building.growth = 0;
            building.harvests = Math.min(1e6, (building.harvests || 0) + 1);
        }
    }
    if (kingdom.build_timer < 12 || buildings.length >= MAX_BUILDINGS) return;
    const farms = buildings.filter(b => b.type === 'farm').length;
    const water_plan = well_construction(world, kingdom);
    for (const [type, recipe] of Object.entries(BUILDINGS)) {
        const limit = type === 'farm' ? farm_target(population) : type === 'well' ? water_plan.limit : 1;
        const essential = ['farm', 'well', 'granary', 'clinic'].includes(type);
        if (!essential && (farms < farm_target(population) || kingdom.food < food_reserve(population))) continue;
        if (buildings.filter(building => building.type === type).length >= limit
            || population < recipe.population || age < recipe.age
            || (type !== 'well' && kingdom.houses.length < 2)
            || (!(type === 'well' && water_plan.prepaid)
                && kingdom.wood < recipe.wood + (type === 'well' && water_plan.unserved ? 0 : essential ? 4 : 10))) continue;
        let place = null;
        for (let attempt = 0; attempt < 30; attempt++) {
            const origin = type === 'well' ? water_plan.origin : kingdom;
            const point = world.land_near(origin.x, origin.y, type === 'well' ? 8 : Math.min(40, 12 + Math.sqrt(population) * 2));
            if (!point || Math.hypot(point.x - origin.x, point.y - origin.y) < 3
                || buildings.some(b => Math.hypot(b.x - point.x, b.y - point.y) < (type === 'castle' || b.type === 'castle' ? 5 : 3))
                || (type === 'well' ? water_plan.houses : kingdom.houses).some(h => Math.hypot(h.x - point.x, h.y - point.y) < (type === 'castle' ? 4 : 2))) continue;
            if (type === 'well' && !find_path(world, water_plan.origin, point, 768).length) continue;
            if (type === 'dock' && ![[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]
                .some(([dx, dy]) => world.inside(point.x + dx, point.y + dy) && world.tile(point.x + dx, point.y + dy) <= 1)) continue;
            place = point; break;
        }
        if (!place) continue;
        buildings.push({ type, x: Math.floor(place.x), y: Math.floor(place.y), growth: 0,
            harvests: 0, stock: 0, integrity: type === 'castle' ? 300 : type === 'watchtower' ? 160 : 100,
            defense_timer: 0 });
        if (type === 'well' && water_plan.prepaid) water_plan.origin.well_kit -= recipe.wood;
        else kingdom.wood -= recipe.wood;
        kingdom.build_timer = 0;
        world.revision++;
        world.log(`${kingdom.name} builds a ${recipe.label.toLowerCase()}.`, 'village');
        break;
    }
}
