import { food_reserve } from './civic.js';

export function kingdom_plan(kingdom, residents, at_war = false) {
    const population = residents.length;
    const soldiers = residents.filter(person => person.role === 'soldier').length;
    if (kingdom.food < food_reserve(population)) return { mode: 'recover', reason: 'Secure farms and food reserves before expansion' };
    if (at_war) return { mode: 'defend', reason: 'Protect towns and replenish the army' };
    if (kingdom.wood < Math.max(12, population / 2)) {
        return { mode: 'build', reason: 'Gather timber for homes and workshops' };
    }
    if (population >= 12 && kingdom.food >= population * 4 && soldiers > 0) {
        return { mode: 'expand', reason: 'Supplies can support another settlement' };
    }
    return { mode: 'develop', reason: 'Improve harvests, equipment, and research' };
}

export function diplomatic_choice(first, second, own_people, other_people, current, war_bias = 0) {
    const own = kingdom_plan(first, own_people, current === 'war');
    const own_army = own_people.filter(p => p.role === 'soldier').length;
    const rival_army = other_people.filter(p => p.role === 'soldier').length;
    if (current === 'war') {
        return own.mode === 'recover' || own_army < rival_army * (0.7 - war_bias) ? 'peace' : null;
    }
    if (current === 'alliance') return null;
    if (war_bias < 0 && own.mode !== 'recover') return 'alliance';
    if (own.mode === 'recover' || own_army < rival_army) return 'alliance';
    if (own.mode === 'expand' && own_army >= Math.max(3, rival_army * (1.4 - war_bias))
        && first.food > own_people.length * (5 - war_bias * 2)) return 'war';
    return null;
}
