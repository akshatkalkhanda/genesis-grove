// Pressure belongs to one attacking kingdom, never to whichever army arrives next.
export const SIEGE_REQUIRED = Object.freeze({ town: 24, capital: 48 });
const owner_id = site => site.kingdom_id || site.id;
const square_distance = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// One small, pure flood fill per occupied assault area. A remote detour does not
// provide access for a siege simply because two troops are close on the screen.
function assault_area(world, site) {
    const reached = new Set();
    if (!world.walkable(site.x, site.y)) return reached;
    const sx = Math.floor(site.x), sy = Math.floor(site.y);
    const queue = [{ x: sx, y: sy }];
    reached.add(world.index(sx, sy));
    for (let index = 0; index < queue.length; index++) {
        const { x, y } = queue[index];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (Math.abs(nx - sx) > 8 || Math.abs(ny - sy) > 8
                || !world.walkable(nx, ny)) continue;
            const key = world.index(nx, ny);
            if (reached.has(key)) continue;
            reached.add(key); queue.push({ x: nx, y: ny });
        }
    }
    return reached;
}

function siege_context(world) {
    const kingdoms = new Map(world.villages.filter(kingdom => kingdom.alive)
        .map(kingdom => [kingdom.id, kingdom]));
    const homes = new Map([...world.villages, ...world.colonies].map(home => [home.id, home]));
    const crews = new Set(world.machines.map(machine => machine.crew_id));
    const wars = new Map(), buckets = new Map();
    for (const relation of world.relations) {
        if (relation.status !== 'war' || !kingdoms.has(relation.a) || !kingdoms.has(relation.b)) continue;
        for (const [from, to] of [[relation.a, relation.b], [relation.b, relation.a]]) {
            if (!wars.has(from)) wars.set(from, new Set());
            wars.get(from).add(to);
        }
    }
    for (const person of world.people) {
        const home = homes.get(person.home_id || person.village_id);
        if (person.role !== 'soldier' || person.health <= 0 || person.prisoner_of || person.voyage_id
            || person.recovering || person.medical_role || crews.has(person.id)
            || !kingdoms.has(person.village_id) || !home || home.alive === false
            || owner_id(home) !== person.village_id || !world.walkable(person.x, person.y)) continue;
        const key = `${Math.floor(person.x / 12)},${Math.floor(person.y / 12)}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(person);
    }
    return { kingdoms, wars, buckets };
}

function summarize(world, site, context) {
    const kind = site.kingdom_id ? 'town' : 'capital', required = SIEGE_REQUIRED[kind];
    const owner = owner_id(site), { kingdoms, wars, buckets } = context;
    const kingdom = kingdoms.get(owner), rivals = wars.get(owner);
    const candidates = [];
    const bx = Math.floor(site.x / 12), by = Math.floor(site.y / 12);
    if (kingdom) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const person of buckets.get(`${bx + dx},${by + dy}`) || []) {
            if (square_distance(person, site) <= 36
                && (person.village_id === owner || rivals?.has(person.village_id))) candidates.push(person);
        }
    }
    const reachable = candidates.length ? assault_area(world, site) : new Set();
    const forces = new Map();
    let defenders = 0;
    for (const person of candidates) {
        if (!reachable.has(world.index(person.x, person.y))) continue;
        if (person.village_id === owner) defenders++;
        else forces.set(person.village_id, (forces.get(person.village_id) || 0) + 1);
    }
    const fortification = kingdom?.buildings?.some(building => building.type === 'castle'
        && world.walkable(building.x, building.y) && square_distance(building, site) <= 18 ** 2) ? 3 : 0;
    const remembered = kingdoms.has(site.siege_attacker_id) && rivals?.has(site.siege_attacker_id) && kingdom;
    const progress = remembered ? Math.max(0, Math.min(required, site.siege || 0)) : 0;
    const attacker_id = progress > 0 ? site.siege_attacker_id
        : [...forces].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
    const attackers = forces.get(attacker_id) || 0;
    const advancing = attackers >= 2 && attackers > defenders + fortification;
    const state = advancing ? 'Advancing' : attackers > 0 ? 'Contested'
        : progress > 0 ? 'Withdrawing' : 'Quiet';
    return { progress, required, percent: progress / required * 100,
        attacker_id, attacker_name: kingdoms.get(attacker_id)?.name || null,
        attackers, defenders, fortification, state, kind,
        rule: kind === 'capital'
            ? 'Capital siege forces kingdom surrender; towns, people and stores join the victor.'
            : 'This town changes kingdom; the defeated capital and other towns remain independent.' };
}

// Public projection is read-only: no cache writes, pressure changes, time or RNG use.
export function siege_summary(world, site) {
    return summarize(world, site, siege_context(world));
}

export function advance_sieges(world, dt = 1) {
    // A direct pulse is at most one simulation second, regardless of army size.
    const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(1, dt)) : 0;
    if (!elapsed) return;
    const sites = [...world.villages.filter(site => site.alive), ...world.colonies];
    let context = siege_context(world);
    for (const site of sites) {
        if (site.alive === false) continue; // Another capital may have surrendered this step.
        if (!context.wars.has(owner_id(site)) && !site.siege && !site.siege_attacker_id) continue;
        const summary = summarize(world, site, context);
        const gain = summary.state === 'Advancing'
            ? Math.min(2, summary.attackers - summary.defenders - summary.fortification) : -1;
        site.siege = Math.max(0, Math.min(summary.required, summary.progress + gain * elapsed));
        site.siege_attacker_id = site.siege > 0 ? summary.attacker_id : null;
        if (site.siege >= summary.required && world.conquer_site(site, summary.attacker_id)) {
            context = siege_context(world); // Ownership/crew/home changes affect the rest of this same pass.
        }
    }
}

export function valid_siege_state(site, village_ids) {
    if (site.siege_attacker_id === undefined || site.siege_attacker_id === null) return true;
    return Number.isInteger(site.siege_attacker_id) && village_ids.has(site.siege_attacker_id)
        && site.siege_attacker_id !== owner_id(site)
        && Number.isFinite(site.siege) && site.siege >= 0
        && site.siege <= SIEGE_REQUIRED[site.kingdom_id ? 'town' : 'capital'];
}
