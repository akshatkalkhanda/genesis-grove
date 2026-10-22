import { apply_damage } from './health.js';

export const WEATHER = Object.freeze({
    raincloud: { label: 'Rain cloud', duration: 24 },
    storm: { label: 'Thunderstorm', duration: 24 },
    drought: { label: 'Drought', duration: 30 },
    blizzard: { label: 'Blizzard', duration: 24 },
    tsunami: { label: 'Tsunami', duration: 20 }
});
export const MAX_WEATHER = 6;
const PULSE = 0.5;
export const tsunami_cooldown = world => Math.max(600, (world.year_length || 20) * 100);
const AUTOMATIC_WEATHER = ['raincloud', 'raincloud', 'raincloud', 'raincloud',
    'raincloud', 'raincloud', 'storm', 'storm', 'drought', 'blizzard', 'tsunami'];

export function deep_ocean(world, x, y) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!world.inside(x + dx, y + dy) || world.tile(x + dx, y + dy) !== 0) return false;
    }
    return true;
}

// A bounded radial wave model: high ground blocks it; low coast floods at most three tiles inland.
export function wave_reaches(world, event, x, y) {
    if (!world.inside(x, y)) return false;
    const distance = Math.hypot(x - event.x, y - event.y);
    const steps = Math.max(1, Math.ceil(distance * 2));
    let land = 0, last = -1;
    for (let i = 1; i <= steps; i++) {
        const px = Math.floor(event.x + (x - event.x) * i / steps);
        const py = Math.floor(event.y + (y - event.y) * i / steps);
        const index = world.index(px, py);
        if (index === last) continue;
        last = index;
        const tile = world.tile(px, py);
        if (tile === 5 || tile === 6 || tile === 7) return false;
        if (tile > 1) { if (++land > 3) return false; }
        else if (land) return false; // A wave does not pass through land to another sea.
    }
    return true;
}

export function spawn_weather(world, kind, x, y, radius = 8) {
    if (!Object.hasOwn(WEATHER, kind) || !world.inside(x, y)) return { ok: false, message: 'Choose a place inside the world.' };
    if (world.weather.length >= MAX_WEATHER) return { ok: false, message: 'Six natural events are already active. Wait for one to pass.' };
    x = Math.floor(x); y = Math.floor(y);
    if (kind === 'tsunami') {
        if (world.weather.some(event => event.kind === 'tsunami')) {
            return { ok: false, message: 'A tsunami is already active. Wait for the wave to recede.' };
        }
        if (!deep_ocean(world, x, y)) return { ok: false, message: 'Start a tsunami in deep ocean, at least three tiles from land or shallows.' };
        let coast = false;
        for (let dy = -40; dy <= 40 && !coast; dy++) for (let dx = -40; dx <= 40; dx++) {
            if (Math.hypot(dx, dy) > 40 || !world.inside(x + dx, y + dy)) continue;
            const tile = world.tile(x + dx, y + dy);
            if (tile > 1 && tile !== 5 && tile !== 6 && wave_reaches(world, { x, y }, x + dx, y + dy)) { coast = true; break; }
        }
        if (!coast) return { ok: false, message: 'Choose deep ocean within 40 tiles of a reachable low coast.' };
    }
    const event = { kind, x, y, radius: Math.max(4, Math.min(12, Math.round(radius))), age: 0, timer: 0, travel: 0 };
    world.weather.push(event);
    if (kind === 'tsunami') world.tsunami_clock = 0;
    world.log(`${WEATHER[kind].label}${kind === 'tsunami' ? ' begins in deep ocean; nearby low coasts are threatened.' : ' begins.'}`, 'disaster', event);
    return { ok: true, message: kind === 'tsunami' ? 'Tsunami forming. Resume time to watch it reach the coast.' : `${WEATHER[kind].label} placed. It develops while time runs.` };
}

function in_wave(world, event, x, y, previous) {
    const distance = Math.hypot(Math.floor(x) - event.x, Math.floor(y) - event.y);
    return distance > previous && distance <= event.travel && wave_reaches(world, event, Math.floor(x), Math.floor(y));
}

function advance_wave(world, event) {
    const previous = event.travel; event.travel = Math.min(40, event.age * 2);
    const r = Math.ceil(event.travel);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = event.x + dx, y = event.y + dy;
        if (!in_wave(world, event, x, y, previous) || world.tile(x, y) <= 1) continue;
        const i = world.index(x, y); world.fire[i] = 0; world.roads[i] = 0;
        world.fertility[i] = Math.min(world.fertility[i], 0.3);
    }
    for (const unit of [...world.people, ...world.animals]) {
        if (unit.voyage_id || !in_wave(world, event, unit.x, unit.y, previous)) continue;
        apply_damage(world, unit, 38, 'tsunami');
    }
    for (const machine of world.machines) if (in_wave(world, event, machine.x, machine.y, previous)
        && machine.kind === 'boat') machine.health -= 65;
    for (const site of [...world.villages, ...world.colonies]) {
        site.houses = site.houses.filter(h => !in_wave(world, event, h.x, h.y, previous));
        for (const building of site.buildings || []) if (in_wave(world, event, building.x, building.y, previous)) {
            building.integrity = Math.max(0, (building.integrity ?? 100) - 45);
            if (building.type === 'farm') building.growth = Math.max(0, building.growth - 0.5);
        }
        if (site.buildings) site.buildings = site.buildings.filter(b => (b.integrity ?? 100) > 0);
        if (site.food !== undefined && in_wave(world, event, site.x, site.y, previous)) site.food *= 0.75;
    }
    world.revision++;
}

function advance_cloud(world, event) {
    const wet = event.kind === 'raincloud' || event.kind === 'storm';
    const r = event.radius;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = Math.floor(event.x) + dx, y = Math.floor(event.y) + dy;
        if (dx * dx + dy * dy > r * r || !world.inside(x, y) || world.tile(x, y) <= 1) continue;
        const i = world.index(x, y);
        if (wet) {
            world.fire[i] = 0;
            world.fertility[i] = Math.min(1, world.fertility[i] + 0.015);
        } else if (event.kind === 'drought') world.fertility[i] = Math.max(0, world.fertility[i] - 0.02);
    }
    if (event.kind === 'storm' && Math.round(event.age / PULSE) % 12 === 0) {
        const angle = world.random() * Math.PI * 2, distance = world.random() * r;
        const x = Math.max(0, Math.min(world.width - 1, event.x + Math.cos(angle) * distance));
        const y = Math.max(0, Math.min(world.tiles.length / world.width - 1, event.y + Math.sin(angle) * distance));
        world.apply('lightning', x, y, 2);
    }
    for (const kingdom of world.villages) for (const building of kingdom.buildings || []) {
        if (building.type !== 'farm' || Math.hypot(building.x - event.x, building.y - event.y) > r) continue;
        if (event.kind === 'drought' || event.kind === 'blizzard') building.growth = Math.max(0, building.growth - 0.008);
    }
    if (event.kind === 'blizzard') for (const unit of [...world.people, ...world.animals]) {
        if (unit.voyage_id || Math.hypot(unit.x - event.x, unit.y - event.y) > r) continue;
        const sheltered = world.villages.some(v => v.houses.some(h => Math.hypot(unit.x - h.x, unit.y - h.y) < 3))
            || world.colonies.some(v => v.houses.some(h => Math.hypot(unit.x - h.x, unit.y - h.y) < 3));
        apply_damage(world, unit, sheltered ? 0.1 : 1, 'cold');
    }
    if (event.kind === 'raincloud' || event.kind === 'storm' || event.kind === 'blizzard') {
        event.x = Math.max(0, Math.min(world.width - 1, event.x + 0.12));
    }
}

export function advance_weather(world, dt) {
    if (world.laws.natural_events) {
        world.tsunami_clock = Math.min(tsunami_cooldown(world), world.tsunami_clock + dt);
    }
    world.weather_clock += dt;
    if (world.weather_clock >= 90) {
        world.weather_clock %= 90;
        if (world.laws.natural_events && world.weather.length < MAX_WEATHER) {
            let kind = AUTOMATIC_WEATHER[Math.floor(world.random() * AUTOMATIC_WEATHER.length)];
            if (kind === 'tsunami' && (world.tsunami_clock < tsunami_cooldown(world)
                || world.weather.some(event => event.kind === 'tsunami'))) kind = 'raincloud';
            for (let attempt = 0; attempt < 24; attempt++) {
                const x = Math.floor(world.random() * world.width), y = Math.floor(world.random() * world.tiles.length / world.width);
                if (kind !== 'tsunami' && world.tile(x, y) <= 1) continue;
                if (spawn_weather(world, kind, x, y).ok) break;
            }
        }
    }
    for (const event of world.weather) {
        event.timer += dt;
        while (event.timer >= PULSE && event.age < WEATHER[event.kind].duration) {
            event.timer -= PULSE; event.age += PULSE;
            if (event.kind === 'tsunami') advance_wave(world, event); else advance_cloud(world, event);
        }
    }
    world.weather = world.weather.filter(event => event.age < WEATHER[event.kind].duration);
}

export function valid_weather(data, width, height) {
    if (data.tsunami_clock !== undefined && (!Number.isFinite(data.tsunami_clock)
        || data.tsunami_clock < 0 || data.tsunami_clock > tsunami_cooldown(data))) return false;
    if (data.weather_clock !== undefined && (!Number.isFinite(data.weather_clock) || data.weather_clock < 0 || data.weather_clock >= 90)) return false;
    if (data.weather === undefined) return true;
    return Array.isArray(data.weather) && data.weather.length <= MAX_WEATHER && data.weather.every(event =>
        event && Object.hasOwn(WEATHER, event.kind) && Number.isFinite(event.x) && event.x >= 0 && event.x < width
        && Number.isFinite(event.y) && event.y >= 0 && event.y < height
        && Number.isInteger(event.radius) && event.radius >= 4 && event.radius <= 12
        && Number.isFinite(event.age) && event.age >= 0 && event.age < WEATHER[event.kind].duration
        && Number.isFinite(event.timer) && event.timer >= 0 && event.timer < PULSE
        && Number.isFinite(event.travel) && event.travel >= 0 && event.travel <= 40
        && (event.kind !== 'tsunami' || event.travel === event.age * 2));
}
