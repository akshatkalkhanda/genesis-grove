import { ignite_fire } from './wildfire.js';
import { creature_stats, develop_creature } from './creatures.js';
import { apply_damage } from './health.js';

export const MYTHIC = Object.freeze({
    angel: { label: 'Angel', health: 250, speed: 1.8 },
    demon: { label: 'Demon', health: 300, speed: 1.4 }
});

export function advance_mythic(world, unit, dt) {
    unit.decision -= dt;
    const angel = unit.species === 'angel';
    let target = null, distance = 14;
    const candidates = angel ? world.animals.filter(other => other.species === 'demon')
        : [...world.people, ...world.animals.filter(other => other.species === 'angel')];
    for (const other of candidates) {
        const gap = Math.hypot(unit.x - other.x, unit.y - other.y);
        if (other.health > 0 && !other.voyage_id && gap < distance) { target = other; distance = gap; }
    }
    unit.task = target ? angel ? 'Banishing demon' : 'Hunting villagers' : angel ? 'Protecting life' : 'Roaming';
    if (target) {
        const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
        unit.dx = Math.cos(angle); unit.dy = Math.sin(angle);
        if (distance < 2.5) {
            apply_damage(world, target, dt * (angel ? 32 : 18) * creature_stats(unit, world.year_length).strength / 10, 'combat');
            develop_creature(unit, 0, world.year_length, dt);
            if (target.health <= 0) { unit.kills++; develop_creature(unit, 0, world.year_length, 15); }
        }
    } else if (unit.decision <= 0) {
        const angle = world.random() * Math.PI * 2;
        unit.dx = Math.cos(angle); unit.dy = Math.sin(angle);
    }
    if (unit.decision <= 0) {
        unit.decision = 2;
        if (angel) {
            for (const other of [...world.people, ...world.animals]) {
                if (other.health <= 0 || other.species === 'demon'
                    || Math.hypot(other.x - unit.x, other.y - unit.y) > 5) continue;
                other.health = Math.min(creature_stats(other, world.year_length).max_health, other.health + 8);
                other.infection = Math.max(0, (other.infection || 0) - 0.2);
            }
            for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) {
                if (world.inside(unit.x + x, unit.y + y)) world.fire[world.index(unit.x + x, unit.y + y)] = 0;
            }
        } else {
            const index = world.index(unit.x, unit.y);
            if ([3, 4, 9, 10, 12, 13, 15].includes(world.tiles[index])) ignite_fire(world, index, 8);
        }
    }
    const speed = MYTHIC[unit.species].speed;
    unit.x = Math.max(0.5, Math.min(world.width - 0.5, unit.x + unit.dx * dt * speed));
    unit.y = Math.max(0.5, Math.min(world.tiles.length / world.width - 0.5, unit.y + unit.dy * dt * speed));
}
