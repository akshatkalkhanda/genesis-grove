const GIVEN_NAMES = ['Ari', 'Fenn', 'Luma', 'Orin', 'Pip', 'Rowan', 'Sora', 'Tavi',
    'Wren', 'Neri', 'Kira', 'Bram', 'Mira', 'Cedar', 'Eira', 'Sol'];
const FAMILY_NAMES = ['Moss', 'Reed', 'Ash', 'Vale', 'Thorn', 'Fern', 'Dawn', 'Brook'];
export const TRAITS = ['brave', 'careful', 'curious', 'hardy', 'industrious'];

export function initialize_creature(unit) {
    unit.xp ??= 0;
    unit.kills ??= 0;
    unit.parents ??= [];
    unit.trait ??= TRAITS[unit.id % TRAITS.length];
    unit.name ??= `${GIVEN_NAMES[unit.id % GIVEN_NAMES.length]} ${FAMILY_NAMES[Math.floor(unit.id / GIVEN_NAMES.length) % FAMILY_NAMES.length]}`;
    return unit;
}

export function creature_stats(unit, year_length = 20) {
    const years = Math.max(0, unit.age / year_length);
    const xp = unit.xp || 0;
    const level = Math.min(30, 1 + Math.floor(Math.sqrt(xp / 25)));
    return {
        level,
        max_health: (unit.species === 'angel' ? 250 : unit.species === 'demon' ? 300 : 100)
            + Math.floor(Math.min(years, 100) * 1.5)
            + (level - 1) * (unit.trait === 'hardy' ? 12 : 8),
        strength: 10 + (level - 1) * 2 + Math.floor(Math.min(years, 100) / 10)
            + (unit.trait === 'brave' && level > 1 ? 2 : 0),
        intelligence: 10 + (level - 1) * 2 + Math.floor(Math.min(years, 100) / 5)
            + (unit.trait === 'curious' && level > 1 ? 3 : 0),
        next_xp: level < 30 ? level * level * 25 : null
    };
}

export function develop_creature(unit, dt, year_length, earned_xp = 0) {
    initialize_creature(unit);
    const before = creature_stats(unit, year_length).max_health;
    unit.age += dt;
    unit.xp = Math.min(1e6, unit.xp + dt / year_length * 2 + earned_xp);
    const after = creature_stats(unit, year_length).max_health;
    if (unit.health > 0) unit.health = Math.min(after, unit.health + after - before);
}
