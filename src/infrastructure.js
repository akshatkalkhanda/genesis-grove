import { find_path } from './pathfinding.js';

export const VEHICLES = Object.freeze({
    cart: { label: 'Harvest cart', speed: 2.1 },
    wagon: { label: 'Steam wagon', speed: 3.1 },
    truck: { label: 'Supply truck', speed: 4.2 },
    hover: { label: 'Photon hovercraft', speed: 5.2 },
    starbarge: { label: 'Stardust carrier', speed: 6.2 }
});
export const MAX_VEHICLES = 120;

export function advance_roads(world, kingdom, dt, level, timber_budget = 0) {
    kingdom.road_timer = Math.min(8, (kingdom.road_timer || 0) + dt);
    if (kingdom.road_timer < 8 || kingdom.houses.length < 2) return;
    kingdom.road_timer = 0;
    const destinations = [...kingdom.houses, ...(kingdom.buildings || []),
        ...world.colonies.filter(site => site.kingdom_id === kingdom.id)];
    kingdom.road_cursor = (kingdom.road_cursor || 0) % destinations.length;
    const target = destinations[kingdom.road_cursor++];
    const route = find_path(world, kingdom, target);
    if (!route.length || route.length > 128) return;
    const grade = level >= 7 ? 3 : level >= 3 ? 2 : 1;
    const cells = [kingdom, ...route].map(point => world.index(point.x, point.y))
        .filter(index => world.roads[index] < grade);
    const cost = Math.ceil(cells.length / 8);
    if (!cells.length || kingdom.wood < cost + Math.max(10, timber_budget)) return;
    kingdom.wood -= cost;
    for (const index of cells) world.roads[index] = grade;
    world.revision++; world.navigation_revision++;
}

export function advance_transport(world, dt, level_of, research_costs = [], budget_of = () => 0) {
    world.vehicles = world.vehicles.filter(vehicle => {
        const kingdom = world.villages.find(v => v.id === vehicle.kingdom_id && v.alive);
        return kingdom && world.walkable(kingdom.x, kingdom.y) && world.walkable(vehicle.x, vehicle.y)
            && world.walkable(vehicle.target_x, vehicle.target_y)
            && kingdom.buildings?.some(b => b.type === 'farm'
                && b.x === vehicle.target_x && b.y === vehicle.target_y);
    });
    for (const kingdom of world.villages.filter(v => v.alive)) {
        kingdom.vehicle_timer = Math.min(24, (kingdom.vehicle_timer || 0) + dt);
        const level = level_of(kingdom);
        const fleet = world.vehicles.filter(vehicle => vehicle.kingdom_id === kingdom.id);
        const kind = level >= 11 ? 'starbarge' : level >= 9 ? 'hover' : level >= 8 ? 'truck' : level >= 7 ? 'wagon' : 'cart';
        const reserve = research_costs[level + 1] || {};
        const materials = level >= 9 ? { iron: 1, stardust: 2 } : kind === 'cart' ? {} : { iron: 2, coal: 1 };
        const affordable = Object.entries(materials).every(([ore, amount]) =>
            (kingdom.ore[ore] || 0) - amount >= (reserve[ore] || 0));
        if (kingdom.vehicle_timer < 24 || level < 2 || kingdom.wood < 8 + Math.max(10, budget_of(kingdom))
            || !kingdom.buildings?.some(b => b.type === 'windmill')) continue;
        const outdated = fleet.find(vehicle => vehicle.kind !== kind);
        if (outdated && affordable) {
            outdated.kind = kind;
            for (const [ore, amount] of Object.entries(materials)) kingdom.ore[ore] -= amount;
            kingdom.vehicle_timer = 0;
        } else if (fleet.length < 2 && world.vehicles.length < MAX_VEHICLES) {
            const farm = kingdom.buildings.find(b => b.type === 'farm'
                && !fleet.some(vehicle => vehicle.target_x === b.x && vehicle.target_y === b.y)
                && find_path(world, kingdom, b).length);
            if (!farm) continue;
            if (!affordable) continue;
            for (const [ore, amount] of Object.entries(materials)) kingdom.ore[ore] -= amount;
            world.vehicles.push({ id: world.next_id++, kingdom_id: kingdom.id, kind,
                x: kingdom.x, y: kingdom.y, target_x: farm.x, target_y: farm.y,
                returning: false, cargo: 0, deliveries: 0 });
            kingdom.wood -= 8; kingdom.vehicle_timer = 0;
            world.log(`${kingdom.name} builds a ${VEHICLES[kind].label.toLowerCase()} to carry farm surplus.`, 'village');
        }
    }
    for (const vehicle of world.vehicles) {
        const kingdom = world.villages.find(v => v.id === vehicle.kingdom_id);
        const target = vehicle.returning ? kingdom : { x: vehicle.target_x, y: vehicle.target_y };
        if (Math.hypot(vehicle.x - target.x, vehicle.y - target.y) > 0.8) {
            world.march(vehicle, { ...target, route: true }, dt, VEHICLES[vehicle.kind].speed);
            continue;
        }
        if (vehicle.returning) {
            kingdom.food += vehicle.cargo;
            if (vehicle.cargo) vehicle.deliveries = Math.min(1e6, vehicle.deliveries + 1);
            vehicle.cargo = 0; vehicle.returning = false;
        } else {
            const farm = kingdom.buildings.find(b => b.type === 'farm'
                && b.x === vehicle.target_x && b.y === vehicle.target_y);
            const capacity = vehicle.kind === 'starbarge' ? 64 : vehicle.kind === 'hover' ? 48
                : vehicle.kind === 'truck' ? 36 : vehicle.kind === 'wagon' ? 24 : 12;
            vehicle.cargo = Math.min(capacity, farm.stock || 0);
            if (!vehicle.cargo) continue;
            farm.stock -= vehicle.cargo; vehicle.returning = true;
        }
    }
}
