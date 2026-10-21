import { creature_stats } from './creatures.js';
import { apply_damage } from './health.js';

export function defense_hit(world, attacker_id, target, damage) {
    if (target.health <= 0 || target.prisoner_of) return;
    const defender = world.villages.find(v => v.id === target.village_id);
    const sheltered = defender?.buildings?.some(b => b.type === 'castle'
        && Math.hypot(b.x - target.x, b.y - target.y) < 9);
    apply_damage(world, target, damage * (sheltered ? 0.65 : 1), 'combat');
    const captor = world.villages.find(v => v.id === attacker_id && v.alive);
    const prison = captor?.buildings?.find(b => b.type === 'prison');
    if (!prison || target.role !== 'soldier' || target.voyage_id
        || Math.hypot(prison.x - target.x, prison.y - target.y) > 18
        || world.people.filter(p => p.prisoner_of === attacker_id).length >= 8
        || target.health > creature_stats(target, world.year_length).max_health * 0.25) return;
    target.health = Math.max(1, target.health);
    target.prisoner_of = attacker_id; target.sentence = world.year_length * 10;
    target.x = prison.x; target.y = prison.y; target.task = 'Imprisoned';
    delete target.work_target;
    world.log(`${captor.name} captures ${target.name} and holds them in its prison.`, 'disaster');
}

export function advance_detention(world, dt) {
    for (const person of world.people) {
        if (!person.prisoner_of || person.health <= 0) continue;
        const captor = world.villages.find(v => v.id === person.prisoner_of && v.alive);
        const prison = captor?.buildings?.find(b => b.type === 'prison');
        person.sentence = Math.max(0, (person.sentence || 0) - dt);
        if (!prison || !person.sentence || person.village_id === captor.id
            || world.relation_status(person.village_id, captor.id) !== 'war') {
            const home = world.villages.find(v => v.id === person.village_id && v.alive);
            if (home) { person.x = home.x; person.y = home.y; }
            person.prisoner_of = null; person.sentence = 0; person.task = 'Released';
            continue;
        }
        person.x = prison.x; person.y = prison.y; person.task = 'Imprisoned';
        if (captor.food >= dt * 0.05) {
            captor.food -= dt * 0.05;
            person.health = Math.min(creature_stats(person, world.year_length).max_health, person.health + dt * 0.3);
        } else apply_damage(world, person, dt * 0.2, 'starvation');
    }
}

export function advance_defenses(world, dt, level_of) {
    for (const kingdom of world.villages.filter(v => v.alive)) {
        for (const building of kingdom.buildings || []) {
            if (!['watchtower', 'castle'].includes(building.type)) continue;
            building.defense_timer = Math.max(0, (building.defense_timer || 0) - dt);
            if (building.defense_timer > 0 || kingdom.food < 1) continue;
            const range = building.type === 'castle' ? 12 : 10;
            const enemy = world.people.filter(p => p.health > 0 && !p.voyage_id && !p.prisoner_of
                && p.role === 'soldier' && world.relation_status(p.village_id, kingdom.id) === 'war'
                && Math.hypot(p.x - building.x, p.y - building.y) <= range)
                .sort((a, b) => a.health - b.health || a.id - b.id)[0];
            if (!enemy) continue;
            const advanced = level_of(kingdom) >= 6;
            world.effects.push({ type: advanced ? 'shell' : 'bolt', x: building.x, y: building.y,
                target_x: enemy.x, target_y: enemy.y, radius: 1, life: 1, duration: 0.7 });
            defense_hit(world, kingdom.id, enemy, advanced ? 16 : 8);
            kingdom.food--; building.defense_timer = advanced ? 3 : 2;
        }
    }
}
