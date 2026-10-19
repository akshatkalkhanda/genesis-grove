export const BUILDINGS = Object.freeze({
    farm: { label: 'Farm', population: 6, age: 0, wood: 8 },
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
    const dust_rate = buildings.reduce((rate, building) => rate
        + ({ observatory: 1, stargate: 3, condenser: 8 }[building.type] || 0), 0);
    if (dust_rate) kingdom.ore.stardust = Math.min(1e6, (kingdom.ore.stardust || 0)
        + dt / world.year_length * dust_rate);
    for (const building of buildings) {
        if (building.type !== 'farm') continue;
        building.growth = Math.min(1, building.growth + dt / 30);
        if (building.growth >= 1) {
            kingdom.food += mill ? 30 : 18;
            building.stock = Math.min(120, (building.stock || 0) + (mill ? 10 : 6));
            building.growth = 0;
            building.harvests = Math.min(1e6, (building.harvests || 0) + 1);
        }
    }
    if (kingdom.build_timer < 12 || buildings.length >= 24) return;
    for (const [type, recipe] of Object.entries(BUILDINGS)) {
        const limit = type === 'farm' ? Math.min(3, Math.ceil(population / 30)) : 1;
        if (buildings.filter(building => building.type === type).length >= limit
            || population < recipe.population || age < recipe.age
            || kingdom.houses.length < 2 || kingdom.wood < recipe.wood + 10) continue;
        let place = null;
        for (let attempt = 0; attempt < 30; attempt++) {
            const point = world.land_near(kingdom.x, kingdom.y, 16);
            if (!point || Math.hypot(point.x - kingdom.x, point.y - kingdom.y) < 3
                || buildings.some(b => Math.hypot(b.x - point.x, b.y - point.y) < (type === 'castle' || b.type === 'castle' ? 5 : 3))
                || kingdom.houses.some(h => Math.hypot(h.x - point.x, h.y - point.y) < (type === 'castle' ? 4 : 2))) continue;
            if (type === 'dock' && ![[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]
                .some(([dx, dy]) => world.inside(point.x + dx, point.y + dy) && world.tile(point.x + dx, point.y + dy) <= 1)) continue;
            place = point; break;
        }
        if (!place) continue;
        buildings.push({ type, x: Math.floor(place.x), y: Math.floor(place.y), growth: 0,
            harvests: 0, stock: 0, integrity: type === 'castle' ? 300 : type === 'watchtower' ? 160 : 100,
            defense_timer: 0 });
        kingdom.wood -= recipe.wood;
        kingdom.build_timer = 0;
        world.revision++;
        world.log(`${kingdom.name} builds a ${recipe.label.toLowerCase()}.`, 'village');
        break;
    }
}
