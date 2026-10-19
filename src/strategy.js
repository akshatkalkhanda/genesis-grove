export function kingdom_plan(kingdom, residents, at_war = false) {
    const population = residents.length;
    const soldiers = residents.filter(person => person.role === 'soldier').length;
    if (kingdom.food < population * 2) return { mode: 'recover', reason: 'Build food reserves' };
    if (at_war) return { mode: 'defend', reason: 'Protect towns and replenish the army' };
    if (kingdom.wood < Math.max(12, population / 2)) {
        return { mode: 'build', reason: 'Gather timber for homes and workshops' };
    }
    if (population >= 12 && kingdom.food >= population * 4 && soldiers > 0) {
        return { mode: 'expand', reason: 'Supplies can support another settlement' };
    }
    return { mode: 'develop', reason: 'Improve harvests, equipment, and research' };
}

export function diplomatic_choice(first, second, own_people, other_people, current) {
    const own = kingdom_plan(first, own_people, current === 'war');
    const own_army = own_people.filter(p => p.role === 'soldier').length;
    const rival_army = other_people.filter(p => p.role === 'soldier').length;
    if (current === 'war') {
        return own.mode === 'recover' || own_army < rival_army * 0.7 ? 'peace' : null;
    }
    if (current === 'alliance') return null;
    if (own.mode === 'recover' || own_army < rival_army) return 'alliance';
    if (own.mode === 'expand' && own_army >= Math.max(3, rival_army * 1.4)
        && first.food > own_people.length * 5) return 'war';
    return null;
}
