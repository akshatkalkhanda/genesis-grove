export const DAMAGE_CAUSES = Object.freeze({
    starvation: 'Food shortage', infection: 'Infection', combat: 'Combat wound',
    fire: 'Burn injury', aging: 'Age-related decline', predation: 'Animal attack',
    meteor: 'Meteor impact', nuke: 'Nuclear blast', lightning: 'Lightning strike',
    acid: 'Acid exposure', erase: 'Divine removal'
});

export function apply_damage(world, unit, amount, cause) {
    if (unit.health <= 0 || !Number.isFinite(amount) || amount <= 0) return;
    const lost = Math.min(unit.health, amount);
    unit.health -= amount;
    unit.health_history ||= [];
    const recent = unit.health_history.find(entry => entry.cause === cause
        && world.time - (entry.since ?? entry.time) < 3);
    if (recent) {
        recent.amount = Math.min(1e6, recent.amount + lost);
        recent.time = world.time;
        unit.health_history.splice(unit.health_history.indexOf(recent), 1);
        unit.health_history.unshift(recent);
    } else unit.health_history.unshift({ cause, amount: lost, time: world.time, since: world.time });
    unit.health_history.length = Math.min(8, unit.health_history.length);
}

export function health_risks(world, unit, kingdom) {
    const risks = [];
    if (unit.infection > 0) risks.push('Infected');
    if (world.fire[world.index(unit.x, unit.y)] > 0) risks.push('Burning');
    if (unit.age / world.year_length > (unit.species ? 50 : 85)) risks.push('Age-related decline');
    if (kingdom && kingdom.food < (unit.role === 'soldier' ? 1.7 : 0.9)) risks.push('Food shortage');
    return risks;
}

export function valid_health_history(unit, world_time) {
    if (unit.health_history === undefined) return true;
    return Array.isArray(unit.health_history) && unit.health_history.length <= 8
        && unit.health_history.every(entry => entry && Object.hasOwn(DAMAGE_CAUSES, entry.cause)
            && Number.isFinite(entry.amount) && entry.amount > 0 && entry.amount <= 1e6
            && Number.isFinite(entry.time) && entry.time >= 0 && entry.time <= world_time
            && (entry.since === undefined || Number.isFinite(entry.since)
                && entry.since >= 0 && entry.since <= entry.time));
}
