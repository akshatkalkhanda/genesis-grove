export const MAX_FOOD_STORES = 120_000_000_000;
export const DEFAULT_DIET = 'omnivore';

export const FOOD_SOURCES = Object.freeze([
    'plant', 'fruit', 'leaves', 'grain', 'grass', 'flowers', 'nectar', 'meat', 'fish',
    'insects', 'algae', 'blood', 'wood', 'soil', 'minerals'
]);

export const CANONICAL_RACES = Object.freeze([
    'human', 'elf', 'dwarf', 'orc', 'foxfolk', 'harefolk', 'catfolk', 'frogfolk',
    'wolfkin', 'hyenafolk', 'beetlefolk'
]);

export const KIN_FOOD_SOURCES = Object.freeze(CANONICAL_RACES.map(race => `kin_${race}`));
export const ALL_FOOD_SOURCES = Object.freeze([...FOOD_SOURCES, ...KIN_FOOD_SOURCES]);

const plants = Object.freeze(['plant', 'fruit', 'leaves', 'grain', 'grass', 'flowers', 'nectar', 'algae']);
const omnivore_foods = Object.freeze([...plants, 'meat', 'fish', 'insects']);

const diet = (id, label, description, sources) => Object.freeze({
    id, label, group: 'Diet', description, sources: Object.freeze([...sources])
});

export const DIET_CATALOG = Object.freeze([
    diet('herbivore', 'Herbivore', 'Eats plant foods available in the shared stores.', plants),
    diet('carnivore', 'Carnivore', 'Eats meat and fish, but not kin-tagged meat.', ['meat', 'fish']),
    diet('omnivore', 'Omnivore', 'Eats a mixed selection of plant foods, meat, fish and insects.', omnivore_foods)
]);

const diet_ids = new Set(DIET_CATALOG.map(entry => entry.id));
const source_ids = new Set(ALL_FOOD_SOURCES);
const drain_order = ALL_FOOD_SOURCES;

const finite_food = value => Number.isFinite(value) ? Math.max(0, Math.min(MAX_FOOD_STORES, value)) : 0;

function clean_stores(stores) {
    const result = {};
    let remaining = MAX_FOOD_STORES;
    if (!stores || typeof stores !== 'object' || Array.isArray(stores)) return result;
    for (const source of ALL_FOOD_SOURCES) {
        const value = stores[source];
        if (!Number.isFinite(value) || value <= 0 || remaining <= 0) continue;
        const kept = Math.min(value, remaining);
        if (kept > 0) result[source] = kept;
        remaining -= kept;
    }
    return result;
}

const total_stores = stores => Object.values(stores).reduce((sum, value) => sum + value, 0);

function reconcile_copy(kingdom) {
    const stores = clean_stores(kingdom?.food_stores);
    const desired = finite_food(kingdom?.food);
    let current = total_stores(stores);
    if (desired > current) {
        const delta = desired - current;
        if (delta > 0) stores.plant = (stores.plant || 0) + delta;
    } else if (desired < current) {
        let drain = current - desired;
        for (const source of drain_order) {
            const take = Math.min(stores[source] || 0, drain);
            if (take > 0) {
                const left = stores[source] - take;
                if (left > 0) stores[source] = left;
                else delete stores[source];
                drain -= take;
            }
        }
    }
    current = total_stores(stores);
    return { food: current, food_stores: stores };
}

export function initialize_diet(unit) {
    if (!unit || typeof unit !== 'object') return undefined;
    if (unit.diet_id === undefined || unit.diet_id === null) unit.diet_id = DEFAULT_DIET;
    return unit.diet_id;
}

// Missing IDs are legacy saves and receive the safe default during migration.
export function valid_diet(unit) {
    return !!unit && typeof unit === 'object'
        && (unit.diet_id === undefined || unit.diet_id === null || diet_ids.has(unit.diet_id));
}

export function valid_food_stores(kingdom) {
    if (!kingdom || typeof kingdom !== 'object') return false;
    if (kingdom.food_stores !== undefined) {
        const stores = kingdom.food_stores;
        if (!stores || typeof stores !== 'object' || Array.isArray(stores)
            || Object.keys(stores).some(source => !source_ids.has(source))) return false;
        let total = 0;
        for (const value of Object.values(stores)) {
            if (!Number.isFinite(value) || value < 0 || value > MAX_FOOD_STORES) return false;
            total += value;
            if (!Number.isFinite(total) || total > MAX_FOOD_STORES) return false;
        }
    }
    return Number.isFinite(kingdom.food) && kingdom.food >= 0 && kingdom.food <= MAX_FOOD_STORES;
}

// Reconcile legacy and existing direct kingdom.food writes. This mutates only food fields.
export function reconcile_food(kingdom) {
    if (!kingdom || typeof kingdom !== 'object') return 0;
    const reconciled = reconcile_copy(kingdom);
    kingdom.food_stores = reconciled.food_stores;
    kingdom.food = reconciled.food;
    return reconciled.food;
}

export function add_food(kingdom, source, amount) {
    if (!kingdom || typeof kingdom !== 'object' || !source_ids.has(source)
        || !Number.isFinite(amount) || amount <= 0) return 0;
    reconcile_food(kingdom);
    const accepted = Math.min(amount, MAX_FOOD_STORES - kingdom.food);
    if (accepted <= 0) return 0;
    kingdom.food_stores[source] = (kingdom.food_stores[source] || 0) + accepted;
    kingdom.food = total_stores(kingdom.food_stores);
    return accepted;
}

export function valid_food_cargo(cargo, expected_amount = undefined) {
    if (!cargo || typeof cargo !== 'object' || Array.isArray(cargo)
        || !Number.isFinite(cargo.amount) || cargo.amount <= 0 || cargo.amount > MAX_FOOD_STORES
        || (expected_amount !== undefined && (!Number.isFinite(expected_amount)
            || expected_amount <= 0 || Math.abs(expected_amount - cargo.amount)
                > Number.EPSILON * Math.max(1, expected_amount) * 8))) return false;
    const stores = cargo.food_stores;
    if (!stores || typeof stores !== 'object' || Array.isArray(stores)
        || Object.keys(stores).some(source => !source_ids.has(source))) return false;
    let total = 0;
    for (const value of Object.values(stores)) {
        if (!Number.isFinite(value) || value <= 0 || value > MAX_FOOD_STORES) return false;
        total += value;
        if (!Number.isFinite(total) || total > MAX_FOOD_STORES) return false;
    }
    return Math.abs(total - cargo.amount) <= Number.EPSILON * Math.max(1, cargo.amount) * 8;
}

// Pack an exact amount from real stores in stable source order; insufficient food is untouched.
export function pack_food(kingdom, amount) {
    if (!kingdom || typeof kingdom !== 'object' || !Number.isFinite(amount)
        || amount <= 0 || amount > MAX_FOOD_STORES) return null;
    reconcile_food(kingdom);
    if (kingdom.food < amount) return null;
    let remaining = amount;
    const packed = {};
    for (const source of ALL_FOOD_SOURCES) {
        const held = kingdom.food_stores[source] || 0;
        const take = Math.min(held, remaining);
        if (take > 0) packed[source] = take;
        remaining -= take;
        if (remaining <= 0) break;
    }
    const packed_amount = total_stores(packed);
    const tolerance = Number.EPSILON * Math.max(1, amount) * 2;
    if (remaining > tolerance || packed_amount + tolerance < amount) return null;
    for (const [source, take] of Object.entries(packed)) {
        const left = kingdom.food_stores[source] - take;
        if (left > 0) kingdom.food_stores[source] = left;
        else delete kingdom.food_stores[source];
    }
    kingdom.food = total_stores(kingdom.food_stores);
    return { amount, food_stores: packed };
}

// Receive the original source mix atomically; failed capacity checks credit nothing.
export function receive_food(kingdom, cargo) {
    if (!kingdom || typeof kingdom !== 'object' || !valid_food_cargo(cargo)) return false;
    reconcile_food(kingdom);
    if (kingdom.food + cargo.amount > MAX_FOOD_STORES) return false;
    for (const [source, amount] of Object.entries(cargo.food_stores)) {
        kingdom.food_stores[source] = (kingdom.food_stores[source] || 0) + amount;
    }
    kingdom.food = total_stores(kingdom.food_stores);
    return true;
}

function allowed_sources(unit) {
    const id = unit?.diet_id || DEFAULT_DIET;
    if (id === 'herbivore') return plants;
    if (id === 'carnivore') return ['meat', 'fish'];
    if (id === 'omnivore') return omnivore_foods;
    const catalog = DIET_CATALOG.find(entry => entry.id === id);
    return catalog ? catalog.sources : [];
}

export function diet_food_available(kingdom, unit, { daylight = false } = {}) {
    if (!kingdom || typeof kingdom !== 'object' || !valid_diet(unit)) return 0;
    const projected = reconcile_copy(kingdom);
    void daylight;
    return allowed_sources(unit).reduce((sum, source) => sum + (projected.food_stores[source] || 0), 0);
}

// Consume only compatible sources; insufficient compatible stock leaves the food untouched.
export function consume_food(kingdom, unit, amount, { daylight = false } = {}) {
    if (!kingdom || typeof kingdom !== 'object' || !Number.isFinite(amount) || amount < 0
        || !valid_diet(unit)) return false;
    reconcile_food(kingdom);
    void daylight;
    if (amount === 0) return true;
    const sources = allowed_sources(unit);
    const available = sources.reduce((sum, source) => sum + (kingdom.food_stores[source] || 0), 0);
    if (available < amount) return false;
    let remaining = amount;
    for (const source of sources) {
        const held = kingdom.food_stores[source] || 0;
        const take = Math.min(held, remaining);
        if (take > 0) {
            const left = held - take;
            if (left > 0) kingdom.food_stores[source] = left;
            else delete kingdom.food_stores[source];
            remaining -= take;
        }
        if (remaining <= 0) break;
    }
    kingdom.food = total_stores(kingdom.food_stores);
    return true;
}
