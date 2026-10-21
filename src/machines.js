import { defense_hit } from './defenses.js';
import { sync_crews } from './crews.js';
import { food_reserve } from './civic.js';

export const MACHINES = Object.freeze({
    boat: { label: 'Coastal boat', domain: 'water', age: 2, building: 'dock', wood: 18, speed: 1.6, health: 180 },
    artillery: { label: 'Artillery', domain: 'land', age: 6, building: 'workshop', wood: 24, speed: 0.9, health: 120 },
    balloon: { label: 'Survey balloon', domain: 'air', age: 7, building: 'aerodrome', wood: 20, speed: 0.9, health: 80 },
    plane: { label: 'Courier aircraft', domain: 'air', age: 8, building: 'aerodrome', wood: 30, speed: 4.8, health: 120 },
    airship: { label: 'Flying transport', domain: 'air', age: 9, building: 'aerodrome', wood: 36, speed: 3.2, health: 160 }
});
export const MAX_MACHINES = 160;

function water_near(world, site) {
    for (let radius = 1; radius <= 4; radius++) {
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
            if (world.inside(site.x + dx, site.y + dy) && world.tile(site.x + dx, site.y + dy) <= 1) {
                return { x: Math.floor(site.x + dx) + 0.5, y: Math.floor(site.y + dy) + 0.5 };
            }
        }
    }
    return null;
}

export function advance_machines(world, dt, level_of, research_costs) {
    world.machines = world.machines.filter(machine => machine.health > 0
        && world.villages.some(v => v.id === machine.kingdom_id && v.alive)
        && (MACHINES[machine.kind].domain !== 'water' || world.tile(machine.x, machine.y) <= 1)
        && (MACHINES[machine.kind].domain !== 'land' || world.walkable(machine.x, machine.y)));
    for (const kingdom of world.villages.filter(v => v.alive)) {
        kingdom.machine_timer = Math.min(20, (kingdom.machine_timer || 0) + dt);
        const population = world.people.filter(p => p.village_id === kingdom.id && p.health > 0).length;
        if (kingdom.food < food_reserve(population) || kingdom.machine_timer < 20 || world.machines.length >= MAX_MACHINES) continue;
        const level = level_of(kingdom), reserve = research_costs[level + 1] || {};
        for (const [kind, recipe] of Object.entries(MACHINES)) {
            if (level < recipe.age || kingdom.wood < recipe.wood + 20
                || world.machines.some(machine => machine.kingdom_id === kingdom.id && machine.kind === kind)) continue;
            const building = kingdom.buildings.find(b => b.type === recipe.building);
            if (!building) continue;
            const iron = kind === 'boat' || kind === 'balloon' ? 0 : kind === 'artillery' ? 4 : 3;
            if (iron && kingdom.ore.iron - iron < (reserve.iron || 0)) continue;
            const origin = recipe.domain === 'water' ? water_near(world, building) : building;
            if (!origin) continue;
            world.machines.push({ id: world.next_id++, kingdom_id: kingdom.id, kind,
                x: origin.x, y: origin.y, dx: 1, dy: 0, health: recipe.health,
                decision: 0, cooldown: 0, cargo: 0, recipient_id: null, delivered: 0 });
            kingdom.wood -= recipe.wood; kingdom.ore.iron -= iron; kingdom.machine_timer = 0;
            world.log(`${kingdom.name} launches a ${recipe.label.toLowerCase()}.`, 'village');
            break;
        }
    }
    for (const machine of world.machines) {
        const kingdom = world.villages.find(v => v.id === machine.kingdom_id);
        const recipe = MACHINES[machine.kind];
        if (!machine.crew_aboard || !world.people.some(p => p.id === machine.crew_id && p.health > 0)) continue;
        machine.decision -= dt; machine.cooldown = Math.max(0, machine.cooldown - dt);
        if (recipe.domain === 'air') {
            machine.decision = 0;
            fly(world, machine, kingdom, dt, recipe);
            continue;
        }
        const range = machine.kind === 'artillery' ? 20 : 12;
        const armed = machine.kind === 'artillery' || level_of(kingdom) >= 6;
        const foe = armed && world.people.find(person => person.health > 0 && !person.voyage_id && !person.prisoner_of
            && world.relation_status(person.village_id, kingdom.id) === 'war'
            && Math.hypot(person.x - machine.x, person.y - machine.y) < range);
        if (foe && machine.cooldown <= 0 && kingdom.food > 2) {
            const impact = { x: foe.x, y: foe.y };
            world.effects.push({ type: 'shell', x: machine.x, y: machine.y, target_x: impact.x,
                target_y: impact.y, radius: 2, life: 1, duration: 1 });
            for (const target of world.people) if (target.health > 0 && !target.prisoner_of
                && world.relation_status(target.village_id, kingdom.id) === 'war'
                && Math.hypot(target.x - impact.x, target.y - impact.y) < 2.5) {
                defense_hit(world, kingdom.id, target, machine.kind === 'artillery' ? 30 : 18);
            }
            for (const enemy of world.villages.filter(v => v.alive && world.relation_status(v.id, kingdom.id) === 'war')) {
                for (const building of enemy.buildings) if (Math.hypot(building.x - impact.x, building.y - impact.y) < 3) {
                    building.integrity = (building.integrity ?? 100) - 30;
                }
                enemy.buildings = enemy.buildings.filter(b => (b.integrity ?? 100) > 0);
            }
            machine.cooldown = machine.kind === 'artillery' ? 4 : 5; kingdom.food -= 2;
        }
        const attacker = world.people.find(p => p.health > 0 && !p.prisoner_of && p.role === 'soldier'
            && world.relation_status(p.village_id, kingdom.id) === 'war'
            && Math.hypot(p.x - machine.x, p.y - machine.y) < 3);
        if (attacker) machine.health -= dt * 12;
        if (machine.kind === 'artillery') {
            machine.decision = 0;
            if (foe) continue;
            const enemy = world.villages.find(v => v.alive && world.relation_status(v.id, kingdom.id) === 'war');
            if (enemy) world.march(machine, { x: enemy.x, y: enemy.y, route: true }, dt, recipe.speed);
        } else {
            machine.fishing_timer = Math.min(20, (machine.fishing_timer || 0) + dt);
            if (machine.fishing_timer >= 20 && !machine.cargo) {
                if (!foe) machine.cargo = 6;
                machine.fishing_timer = 0;
            }
            const dock = kingdom.buildings.find(b => b.type === 'dock');
            const harbor = machine.cargo && dock ? water_near(world, dock) : null;
            if (harbor && Math.hypot(machine.x - harbor.x, machine.y - harbor.y) <= 2) {
                kingdom.food += machine.cargo; machine.cargo = 0;
                machine.delivered = Math.min(1e6, machine.delivered + 1);
            }
            if (harbor) {
                const angle = Math.atan2(harbor.y - machine.y, harbor.x - machine.x);
                for (const offset of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
                    const dx = Math.cos(angle + offset), dy = Math.sin(angle + offset);
                    const x = machine.x + dx * dt * recipe.speed, y = machine.y + dy * dt * recipe.speed;
                    if (world.inside(x, y) && world.tile(x, y) <= 1) {
                        machine.dx = dx; machine.dy = dy; break;
                    }
                }
                machine.decision = 3;
            }
            if (machine.decision <= 0) {
                const angle = world.random() * Math.PI * 2;
                machine.dx = Math.cos(angle); machine.dy = Math.sin(angle); machine.decision = 3;
            }
            const nx = machine.x + machine.dx * dt * recipe.speed, ny = machine.y + machine.dy * dt * recipe.speed;
            if (world.inside(nx, ny) && world.tile(nx, ny) <= 1) { machine.x = nx; machine.y = ny; }
            else machine.decision = 0;
        }
    }
    sync_crews(world);
}

function fly(world, machine, kingdom, dt, recipe) {
    let target = kingdom;
    if (machine.kind === 'balloon') {
        const angle = world.time / 30 + machine.id;
        target = { x: Math.max(1, Math.min(world.width - 1, kingdom.x + Math.cos(angle) * 18)),
            y: Math.max(1, Math.min(world.tiles.length / world.width - 1, kingdom.y + Math.sin(angle) * 18)) };
        kingdom.tech_points = Math.min(1e6, kingdom.tech_points + dt / world.year_length * 0.25);
    } else {
        let recipient = machine.recipient_id && world.villages.find(v => v.id === machine.recipient_id && v.alive
            && world.relation_status(v.id, kingdom.id) !== 'war');
        if (machine.recipient_id && !recipient) {
            kingdom.food += machine.cargo; machine.cargo = 0; machine.recipient_id = null;
        }
        if (!machine.cargo && !machine.recipient_id && Math.hypot(machine.x - kingdom.x, machine.y - kingdom.y) < 2) {
            recipient = world.villages.find(v => v.alive && v.id !== kingdom.id
                && world.relation_status(v.id, kingdom.id) !== 'war' && kingdom.food > v.food + 30);
            if (recipient) { machine.recipient_id = recipient.id; machine.cargo = 12; kingdom.food -= 12; }
        }
        if (machine.cargo && recipient) target = recipient;
        if (machine.cargo && recipient && Math.hypot(machine.x - recipient.x, machine.y - recipient.y) < 1) {
            recipient.food += machine.cargo; machine.cargo = 0; machine.recipient_id = null;
            machine.delivered = Math.min(1e6, machine.delivered + 1); target = kingdom;
        }
    }
    const distance = Math.hypot(target.x - machine.x, target.y - machine.y);
    if (distance < 0.2) return;
    machine.dx = (target.x - machine.x) / distance; machine.dy = (target.y - machine.y) / distance;
    const travel = Math.min(distance, dt * recipe.speed);
    machine.x += machine.dx * travel; machine.y += machine.dy * travel;
}
