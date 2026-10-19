export const BUILDINGS = Object.freeze({
    farm: { label: 'Farm', population: 6, age: 0, wood: 8 },
    windmill: { label: 'Windmill', population: 12, age: 1, wood: 18 },
    armory: { label: 'Armory', population: 16, age: 2, wood: 22 },
    camp: { label: 'Training camp', population: 10, age: 0, wood: 14 }
});

export function advance_buildings(world, kingdom, dt, population, age) {
    kingdom.buildings ||= [];
    kingdom.build_timer = Math.min(60, (kingdom.build_timer || 0) + dt);
    const buildings = kingdom.buildings;
    const mill = buildings.some(building => building.type === 'windmill');
    for (const building of buildings) {
        if (building.type !== 'farm') continue;
        building.growth = Math.min(1, building.growth + dt / 30);
        if (building.growth >= 1) {
            kingdom.food += mill ? 30 : 18;
            building.growth = 0;
            building.harvests = Math.min(1e6, (building.harvests || 0) + 1);
        }
    }
    if (kingdom.build_timer < 12 || buildings.length >= 6) return;
    for (const [type, recipe] of Object.entries(BUILDINGS)) {
        const limit = type === 'farm' ? Math.min(3, Math.ceil(population / 30)) : 1;
        if (buildings.filter(building => building.type === type).length >= limit
            || population < recipe.population || age < recipe.age
            || kingdom.houses.length < 2 || kingdom.wood < recipe.wood + 10) continue;
        let place = null;
        for (let attempt = 0; attempt < 30; attempt++) {
            const point = world.land_near(kingdom.x, kingdom.y, 9);
            if (!point || Math.hypot(point.x - kingdom.x, point.y - kingdom.y) < 3
                || buildings.some(b => Math.hypot(b.x - point.x, b.y - point.y) < 3)
                || kingdom.houses.some(h => Math.hypot(h.x - point.x, h.y - point.y) < 2)) continue;
            place = point; break;
        }
        if (!place) continue;
        buildings.push({ type, x: Math.floor(place.x), y: Math.floor(place.y), growth: 0,
            harvests: 0 });
        kingdom.wood -= recipe.wood;
        kingdom.build_timer = 0;
        world.log(`${kingdom.name} builds a ${recipe.label.toLowerCase()}.`, 'village');
        break;
    }
}
