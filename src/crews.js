import { creature_stats } from './creatures.js';

export function prepare_crews(world) {
    world._crew_assignments = new Map();
    const used = new Set();
    for (const machine of world.machines) {
        const kingdom = world.villages.find(v => v.id === machine.kingdom_id && v.alive);
        if (!kingdom || machine.health <= 0) continue;
        let person = world.people.find(p => p.id === machine.crew_id && p.village_id === kingdom.id
            && p.health > 0 && !p.prisoner_of && !p.voyage_id && !used.has(p.id));
        if (!person) {
            machine.crew_id = null; machine.crew_aboard = false;
            const port = kingdom.buildings?.find(b => b.type === (machine.kind === 'boat' ? 'dock' :
                machine.kind === 'artillery' ? 'workshop' : 'aerodrome')) || kingdom;
            const boarding = machine.kind === 'boat' ? world.land_near(machine.x, machine.y, 5) : machine;
            if (!boarding) continue;
            const mass = world._army_masses?.[world.index(boarding.x, boarding.y)];
            const adults = world.people.filter(p => p.village_id === kingdom.id && p.health > 0
                && !p.prisoner_of && !p.voyage_id && !p.recovering && !p.medical_role
                && !used.has(p.id) && p.age / world.year_length >= 18
                && p.health >= creature_stats(p, world.year_length).max_health * 0.6
                && (p.role !== 'soldier' || machine.kind === 'artillery')
                && (mass === undefined || world._army_masses[world.index(p.x, p.y)] === mass));
            const protected_ids = new Set(['farmer', 'lumberjack', 'builder'].map(job =>
                adults.find(p => p.job === job)?.id));
            person = adults.filter(p => !protected_ids.has(p.id)).sort((a, b) =>
                Math.hypot(a.x - port.x, a.y - port.y) - Math.hypot(b.x - port.x, b.y - port.y))[0];
            if (!person) continue;
            machine.crew_id = person.id;
            machine.boarding = { x: boarding.x, y: boarding.y };
        }
        used.add(person.id);
        world._crew_assignments.set(person.id, machine);
    }
}

export function crew_intent(world, person) {
    const machine = world._crew_assignments?.get(person.id);
    if (!machine) return null;
    if (!machine.crew_aboard && machine.boarding
        && Math.hypot(person.x - machine.boarding.x, person.y - machine.boarding.y) <= 2) {
        machine.crew_aboard = true;
        person.x = machine.x; person.y = machine.y;
    }
    person.task = machine.crew_aboard ? machine.kind === 'boat' ? 'Sailing coastal boat'
        : machine.kind === 'artillery' ? 'Operating artillery' : 'Piloting aircraft' : 'Boarding vehicle';
    return { target: machine.crew_aboard ? null : { ...machine.boarding, route: true }, holding: machine.crew_aboard };
}

export function sync_crews(world) {
    for (const machine of world.machines) {
        const person = world.people.find(p => p.id === machine.crew_id && p.health > 0);
        if (!person) { machine.crew_id = null; machine.crew_aboard = false; continue; }
        if (machine.crew_aboard) { person.x = machine.x; person.y = machine.y; }
    }
}
