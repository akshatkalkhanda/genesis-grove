export const WIDTH = 192;
export const HEIGHT = 128;
export const T = Object.freeze({ OCEAN: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, HILL: 5, MOUNTAIN: 6, LAVA: 7, ASH: 8 });
export const TERRAIN_NAMES = ['Deep ocean', 'Shallow water', 'Sand', 'Meadow', 'Forest', 'Highlands', 'Mountain', 'Lava', 'Ash'];
export const CIV_COLORS = ['#e9c87b', '#b9a4e6', '#e58f83', '#83c5cd', '#c3da89', '#efb6d0', '#95acdf', '#dfae76'];
const NAMES = ['Amberwick', 'Willowmere', 'Rosehaven', 'Tidewatch', 'Mossvale', 'Sunhollow', 'Briarford', 'Cloudrest'];
const MAX_VILLAGES = 120;
const MAX_PEOPLE = 1200;
const RACES = Object.freeze({ human: { label: 'Human', color: '#e9c87b' }, elf: { label: 'Elven', color: '#9bcf91' }, dwarf: { label: 'Dwarven', color: '#d5a776' }, orc: { label: 'Orcish', color: '#a9bd77' } });
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function kingdom_color(index) {
    const hue = (index * 137.508) % 360;
    const channel = n => {
        const k = (n + hue / 30) % 12;
        const value = 0.68 - 0.22 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(value * 255).toString(16).padStart(2, '0');
    };
    return `#${channel(0)}${channel(8)}${channel(4)}`;
}
function hash_string(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return h >>> 0;
}
function noise(x, y, seed) {
    const hash = (a, b) => {
        let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy) * (1 - sx) + hash(ix + 1, iy) * sx;
    const b = hash(ix, iy + 1) * (1 - sx) + hash(ix + 1, iy + 1) * sx;
    return a * (1 - sy) + b * sy;
}
export class World {
    constructor({ seed = 'emerald-17', name = 'The Emerald Isles', preset = 'islands', inhabited = true, scenario = 'sandbox' } = {}) {
        this.name = name.slice(0, 40);
        this.seed = String(seed);
        this.rng = hash_string(this.seed) || 1;
        this.time = 0;
        this.tick = 0;
        this.next_id = 1;
        this.tiles = new Uint8Array(WIDTH * HEIGHT);
        this.fire = new Float32Array(WIDTH * HEIGHT);
        this.fertility = new Float32Array(WIDTH * HEIGHT).fill(0.8);
        this.people = [];
        this.animals = [];
        this.villages = [];
        this.relations = [];
        this.scenario = scenario === 'hundred' ? 'hundred' : 'sandbox';
        this.year_length = this.scenario === 'hundred' ? 2 : 20;
        this.laws = { rebellions: false, diplomacy: this.scenario === 'hundred' };
        this.milestone = 0;
        this.events = [];
        this.effects = [];
        this.revision = 1;
        const landscape = this.scenario === 'hundred' ? 'continent' : preset;
        this.generate(landscape);
        this.log('A new world awakens. What will you make of it?', 'creation');
        if ((inhabited || this.scenario === 'hundred') && landscape !== 'empty') {
            if (this.scenario === 'hundred') this.seed_hundred_kingdoms();
            else this.seed_life();
        }
    }
    random() {
        let x = this.rng;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        this.rng = x >>> 0;
        return this.rng / 4294967296;
    }
    get year() { return Math.floor(this.time / this.year_length) + 1; }
    get max_people() { return this.scenario === 'hundred' ? MAX_PEOPLE : 600; }
    index(x, y) { return Math.floor(y) * WIDTH + Math.floor(x); }
    inside(x, y) { return x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT; }
    tile(x, y) { return this.inside(x, y) ? this.tiles[this.index(x, y)] : T.OCEAN; }
    walkable(x, y) { const t = this.tile(x, y); return t >= T.SAND && t <= T.HILL; }
    set_tile(x, y, type) {
        if (!this.inside(x, y)) return;
        const i = this.index(x, y);
        this.tiles[i] = type;
        if (type <= T.SHALLOW) this.fire[i] = 0;
        this.revision++;
    }
    generate(preset) {
        if (preset === 'empty') return;
        const seed = hash_string(this.seed);
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const nx = (x - WIDTH / 2) / (WIDTH / 2), ny = (y - HEIGHT / 2) / (HEIGHT / 2);
            const edge = Math.pow(Math.max(Math.abs(nx), Math.abs(ny)), 5) * 0.58;
            const broad = noise(x / 38, y / 38, seed);
            const detail = noise(x / 12, y / 12, seed + 23);
            const fine = noise(x / 4, y / 4, seed + 97);
            let h = broad * 0.64 + detail * 0.27 + fine * 0.09 - edge;
            if (preset === 'continent') h += 0.15 * (1 - nx * nx - ny * ny);
            let t = h < 0.39 ? T.OCEAN : h < 0.445 ? T.SHALLOW : h < 0.478 ? T.SAND : h < 0.65 ? T.GRASS : h < 0.73 ? T.HILL : T.MOUNTAIN;
            if (t === T.GRASS && noise(x / 8, y / 8, seed + 51) > 0.48 && this.random() > 0.2) t = T.FOREST;
            this.tiles[this.index(x, y)] = t;
        }
    }
    seed_life() {
        const spots = [];
        for (let attempts = 0; attempts < 3000 && spots.length < 3; attempts++) {
            const x = 15 + this.random() * (WIDTH - 30), y = 15 + this.random() * (HEIGHT - 30);
            if (this.tile(x, y) !== T.GRASS || spots.some(p => Math.hypot(p.x - x, p.y - y) < 32)) continue;
            let land = 0;
            for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (this.walkable(x + dx, y + dy)) land++;
            if (land < 100) continue;
            spots.push({ x, y });
            const village = this.found_village(x, y);
            for (let i = 0; i < 9; i++) {
                const p = this.land_near(x, y, 4);
                if (p) this.add_person(p.x, p.y, village.id);
            }
            for (let i = 0; i < 7; i++) {
                const p = this.land_near(x, y, 12);
                if (p) this.add_animal(p.x, p.y, i === 0 ? 'wolf' : 'sheep');
            }
        }
    }
    seed_hundred_kingdoms() {
        const spots = [];
        const candidates = [];
        for (let y = 5; y < HEIGHT - 5; y += 2) for (let x = 5; x < WIDTH - 5; x += 2) {
            if (this.walkable(x, y)) candidates.push({ x, y, key: this.random() });
        }
        candidates.sort((a, b) => a.key - b.key);
        for (const distance of [64, 36, 16]) {
            for (const candidate of candidates) {
                if (spots.length === 100) break;
                const { x, y } = candidate;
                if (spots.some(p => (p.x - x) ** 2 + (p.y - y) ** 2 < distance)) continue;
                spots.push({ x, y });
                const race = ['human', 'elf', 'dwarf', 'orc'][spots.length % 4];
                const village = this.found_village(x, y, race);
                for (let i = 0; i < 3; i++) {
                    const p = this.land_near(x, y, 2);
                    if (p) this.add_person(p.x, p.y, village.id, race);
                }
            }
            if (spots.length === 100) break;
        }
        for (let i = 0; i < 50; i++) {
            const place = candidates[Math.floor(this.random() * candidates.length)];
            if (place) this.add_animal(place.x, place.y, i % 12 === 0 ? 'wolf' : i % 3 === 0 ? 'deer' : 'sheep');
        }
        this.log(`${spots.length} kingdoms enter the contest. Which will survive a thousand years?`, 'creation');
    }
    land_near(x, y, radius) {
        for (let i = 0; i < 30; i++) {
            const nx = clamp(x + (this.random() - 0.5) * radius * 2, 1, WIDTH - 2);
            const ny = clamp(y + (this.random() - 0.5) * radius * 2, 1, HEIGHT - 2);
            if (this.walkable(nx, ny)) return { x: nx, y: ny };
        }
        return this.walkable(x, y) ? { x, y } : null;
    }
    log(text, kind = 'life') {
        this.events.unshift({ text, year: this.year, kind });
        this.events = this.events.slice(0, 40);
    }
    relation_status(a, b) {
        if (a === b) return 'peace';
        const low = Math.min(a, b), high = Math.max(a, b);
        return this.relations.find(r => r.a === low && r.b === high)?.status || 'peace';
    }
    set_relation(a, b, status) {
        if (!['peace', 'alliance', 'war'].includes(status) || a === b) return false;
        const first = this.villages.find(v => v.id === a && v.alive);
        const second = this.villages.find(v => v.id === b && v.alive);
        if (!first || !second || this.relation_status(a, b) === status) return false;
        const low = Math.min(a, b), high = Math.max(a, b);
        const existing = this.relations.find(r => r.a === low && r.b === high);
        if (existing) existing.status = status;
        else this.relations.push({ a: low, b: high, status });
        const action = status === 'war' ? 'declare war' : status === 'alliance' ? 'form an alliance' : 'make peace';
        this.log(`${first.name} and ${second.name} ${action}.`, status === 'war' ? 'disaster' : 'village');
        return true;
    }
    found_village(x, y, race = 'human') {
        if (this.villages.length >= MAX_VILLAGES) return this.villages.reduce((a, b) => Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b);
        const n = this.villages.length;
        const profile = RACES[race] || RACES.human;
        const name = n < NAMES.length ? NAMES[n] : `${NAMES[n % NAMES.length]} ${Math.floor(n / NAMES.length) + 1}`;
        const color = this.scenario === 'hundred' ? kingdom_color(n) : profile.color;
        const village = { id: this.next_id++, x, y, race, name: `${profile.label} ${name}`, color, food: 35, wood: 15, age: 0, birth_timer: 0, expansion_timer: 0, houses: [], alive: true };
        this.villages.push(village);
        this.add_house(village);
        this.log(`${village.name} is founded. A new story begins.`, 'village');
        return village;
    }
    add_house(v) {
        for (let i = 0; i < 35; i++) {
            const radius = 2 + Math.sqrt(v.houses.length) * 2;
            const p = this.land_near(v.x, v.y, radius);
            if (!p || v.houses.some(h => Math.hypot(h.x - p.x, h.y - p.y) < 2.5)) continue;
            p.x = Math.floor(p.x); p.y = Math.floor(p.y);
            this.set_tile(p.x, p.y, T.GRASS);
            v.houses.push(p);
            return true;
        }
        return false;
    }
    add_person(x, y, village_id = null, race = 'human') {
        if (!this.walkable(x, y) || this.people.length >= this.max_people) return false;
        if (!village_id) {
            let nearest = this.villages.filter(v => v.alive && v.race === race).find(v => Math.hypot(v.x - x, v.y - y) < 22);
            nearest ||= this.found_village(x, y, race);
            nearest.alive = true;
            village_id = nearest.id;
        }
        this.people.push({ id: this.next_id++, x, y, village_id, race: RACES[race] ? race : 'human', health: 100, age: 0, dx: 0, dy: 0, decision: this.random(), gather: this.random() * 3, infection: 0 });
        return true;
    }
    add_animal(x, y, species) {
        if (!this.walkable(x, y) || this.animals.length >= 350) return false;
        this.animals.push({ id: this.next_id++, x, y, species, health: 100, age: 0, dx: 0, dy: 0, decision: 0, infection: 0 });
        return true;
    }
    apply(tool, x, y, radius = 4) {
        x = Math.floor(x); y = Math.floor(y);
        if (!this.inside(x, y)) return;
        const terrain = { ocean: T.OCEAN, shallow: T.SHALLOW, sand: T.SAND, grass: T.GRASS, forest: T.FOREST, hill: T.HILL, mountain: T.MOUNTAIN, lava: T.LAVA };
        if (tool in RACES || ['sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken'].includes(tool)) {
            if (!this.walkable(x, y)) return;
            if (tool in RACES) {
                for (let i = 0; i < 3; i++) {
                    const p = this.land_near(x, y, Math.max(1, radius / 2));
                    if (p) this.add_person(p.x, p.y, null, tool);
                }
            } else this.add_animal(x + 0.5, y + 0.5, tool);
            return;
        }
        const r = ['meteor', 'nuke'].includes(tool) ? radius + (tool === 'nuke' ? 8 : 2) : radius;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r || !this.inside(x + dx, y + dy)) continue;
            const i = this.index(x + dx, y + dy), t = this.tiles[i];
            if (tool in terrain) this.set_tile(x + dx, y + dy, terrain[tool]);
            if (tool === 'fire' && t >= T.GRASS && t <= T.HILL) this.fire[i] = 10 + this.random() * 10;
            if (tool === 'rain') {
                this.fire[i] = 0;
                this.fertility[i] = 1;
                if (t === T.ASH || (t === T.SAND && this.random() > 0.6)) this.set_tile(x + dx, y + dy, T.GRASS);
                if (t === T.LAVA) this.set_tile(x + dx, y + dy, T.ASH);
            }
            if (tool === 'bless') this.fertility[i] = 1;
            if (tool === 'acid' && t > T.SHALLOW) { this.fertility[i] = 0; if (t !== T.LAVA) this.set_tile(x + dx, y + dy, T.ASH); }
            if (tool === 'meteor' && t > T.SHALLOW) {
                this.set_tile(x + dx, y + dy, dx * dx + dy * dy < r * r * 0.2 ? T.LAVA : T.ASH);
                this.fire[i] = 0;
            }
            if (tool === 'nuke' && t > T.SHALLOW) {
                this.set_tile(x + dx, y + dy, dx * dx + dy * dy < r * r * 0.3 ? T.LAVA : T.ASH);
                this.fire[i] = dx * dx + dy * dy > r * r * 0.55 ? 12 + this.random() * 10 : 0;
            }
            if (tool === 'lightning' && Math.abs(dx) + Math.abs(dy) < 3 && t >= T.GRASS && t <= T.HILL) this.fire[i] = 12;
        }
        if (['meteor', 'nuke', 'lightning', 'rain', 'bless', 'acid'].includes(tool)) {
            this.effects.push({ type: tool, x, y, radius: r, life: 1, duration: tool === 'rain' ? 1.5 : 0.8 });
        }
        if (tool === 'meteor') this.log('A star falls. The earth will remember.', 'disaster');
        if (tool === 'nuke') this.log('A terrible flash reshapes the land.', 'disaster');
        if (tool === 'plague') this.log('A strange sickness takes hold.', 'disaster');
        if (tool === 'acid') this.log('Caustic rain poisons the land.', 'disaster');
        if (tool === 'lightning') this.log('Thunder breaks the quiet.', 'disaster');
        const damage = tool === 'nuke' ? 300 : tool === 'meteor' ? 200 : tool === 'lightning' ? 75 : tool === 'acid' ? 35 : tool === 'erase' ? 1000 : 0;
        for (const list of [this.people, this.animals]) for (const unit of list) {
            if (Math.hypot(unit.x - x, unit.y - y) > r) continue;
            unit.health -= damage;
            if (tool === 'bless') unit.health = 100;
            if (tool === 'plague') unit.infection = 1;
            if (tool === 'bless') unit.infection = 0;
        }
        if (tool === 'meteor' || tool === 'nuke' || tool === 'erase') for (const v of this.villages) {
            v.houses = v.houses.filter(h => Math.hypot(h.x - x, h.y - y) > r);
        }
        this.clean_up();
    }
    clean_up() {
        this.people = this.people.filter(p => p.health > 0 && this.walkable(p.x, p.y));
        this.animals = this.animals.filter(p => p.health > 0 && this.walkable(p.x, p.y));
        for (const v of this.villages) {
            v.houses = v.houses.filter(h => this.walkable(h.x, h.y) && this.fire[this.index(h.x, h.y)] < 5);
            if (v.alive && !this.people.some(p => p.village_id === v.id)) {
                v.alive = false;
                this.log(`${v.name} falls silent. Its story lives on.`, 'disaster');
            }
        }
    }
    move(unit, dt, speed) {
        const nx = clamp(unit.x + unit.dx * dt * speed, 0.5, WIDTH - 0.5);
        const ny = clamp(unit.y + unit.dy * dt * speed, 0.5, HEIGHT - 0.5);
        if (this.walkable(nx, ny)) { unit.x = nx; unit.y = ny; }
        else unit.decision = 0;
    }
    advance_history() {
        if (this.laws.diplomacy && this.tick % 80 === 0) {
            const alive = this.villages.filter(v => v.alive);
            if (alive.length > 1) {
                const first = alive[Math.floor(this.random() * alive.length)];
                const neighbours = alive.filter(v => v.id !== first.id && Math.hypot(v.x - first.x, v.y - first.y) < 30);
                const second = neighbours[Math.floor(this.random() * neighbours.length)];
                if (second) {
                    const current = this.relation_status(first.id, second.id);
                    const roll = this.random();
                    const next = current === 'war' ? (roll < 0.38 ? 'peace' : null)
                        : current === 'alliance' ? (roll < 0.18 ? 'peace' : null)
                            : roll < 0.34 ? 'war' : roll < 0.49 ? 'alliance' : null;
                    if (next) this.set_relation(first.id, second.id, next);
                }
            }
        }
        if (this.laws.rebellions && this.tick % 160 === 0 && this.villages.length < MAX_VILLAGES) {
            const populations = new Map();
            for (const person of this.people) populations.set(person.village_id, (populations.get(person.village_id) || 0) + 1);
            const candidates = this.villages.filter(v => v.alive && v.age > 40 && (populations.get(v.id) || 0) >= 14);
            const parent = candidates.length ? candidates[Math.floor(this.random() * candidates.length)] : null;
            if (parent && this.random() < 0.15) {
                const rebels = this.people.filter(p => p.village_id === parent.id).slice(0, 4);
                let place = null;
                for (let attempt = 0; attempt < 20 && !place; attempt++) {
                    const candidate = this.land_near(parent.x, parent.y, 10);
                    if (candidate && this.villages.every(v => !v.alive || Math.hypot(v.x - candidate.x, v.y - candidate.y) > 5)) place = candidate;
                }
                if (place) {
                    const child = this.found_village(place.x, place.y, parent.race);
                    for (const person of rebels) person.village_id = child.id;
                    this.set_relation(parent.id, child.id, 'war');
                    this.log(`${child.name} breaks away from ${parent.name}.`, 'disaster');
                }
            }
        }
        const milestones = [100, 250, 500, 1000];
        if (this.scenario === 'hundred' && this.milestone < milestones.length && this.year >= milestones[this.milestone]) {
            const alive = this.villages.slice(0, 100).filter(v => v.alive).length;
            this.log(`Year ${milestones[this.milestone]}: ${alive} kingdoms remain from the original 100.`, 'creation');
            this.milestone++;
        }
    }
    step(dt) {
        dt = clamp(dt, 0, 0.25);
        this.time += dt;
        this.tick++;
        this.advance_history();
        const war_targets = new Map();
        for (const relation of this.relations) {
            if (relation.status !== 'war') continue;
            for (const [a, b] of [[relation.a, relation.b], [relation.b, relation.a]]) {
                if (!war_targets.has(a)) war_targets.set(a, new Set());
                war_targets.get(a).add(b);
            }
        }
        for (const p of this.people) {
            if (p.health <= 0) continue;
            p.age += dt;
            p.decision -= dt;
            p.gather += dt;
            const v = this.villages.find(v => v.id === p.village_id);
            const enemies = war_targets.get(p.village_id);
            if (p.decision <= 0) {
                let a = this.random() * Math.PI * 2;
                const target = enemies && this.villages.find(other => other.alive && enemies.has(other.id) && Math.hypot(other.x - p.x, other.y - p.y) < 32);
                if (target && p.age > 5) a = Math.atan2(target.y - p.y, target.x - p.x);
                else if (v && Math.hypot(p.x - v.x, p.y - v.y) > 9 + Math.sqrt(v.houses.length)) a = Math.atan2(v.y - p.y, v.x - p.x);
                p.dx = Math.cos(a); p.dy = Math.sin(a); p.decision = 0.5 + this.random() * 3;
            }
            if (enemies) {
                let foe = null, nearest = 100;
                for (const other of this.people) {
                    if (other.health <= 0 || !enemies.has(other.village_id)) continue;
                    const distance = (other.x - p.x) ** 2 + (other.y - p.y) ** 2;
                    if (distance < nearest) { foe = other; nearest = distance; }
                }
                if (foe) {
                    const angle = Math.atan2(foe.y - p.y, foe.x - p.x);
                    p.dx = Math.cos(angle); p.dy = Math.sin(angle);
                    if (nearest < 2.25) foe.health -= dt * (p.race === 'orc' ? 16 : 12) * (foe.race === 'orc' ? 0.75 : 1);
                }
            }
            this.move(p, dt, 1.3);
            const i = this.index(p.x, p.y);
            if (p.infection > 0) { p.infection = Math.max(0, p.infection - dt * 0.025); p.health -= dt * 3; if (this.random() < dt * 0.08) { const nearby = this.people.find(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 2); if (nearby) nearby.infection = 1; } }
            if (this.fire[i] > 0) p.health -= dt * 38;
            if (p.age > 700) p.health -= dt * 2;
            if (v && p.gather >= 3) {
                p.gather = 0;
                const terrain = this.tiles[i];
                let food = terrain === T.GRASS || terrain === T.FOREST ? this.fertility[i] * 2.4 : 0.4;
                if (p.race === 'elf' && terrain === T.FOREST) food *= 1.25;
                if (p.race === 'dwarf' && terrain === T.HILL) food = this.fertility[i] * 2.4;
                if (p.race === 'human') food *= 1.15;
                v.food += food;
                if (terrain === T.FOREST) v.wood += p.race === 'elf' ? 2 : 1;
                if (v.food < 1) p.health -= 6;
                else { v.food -= 0.9; p.health = Math.min(100, p.health + 1); }
            }
        }
        for (const animal of this.animals) {
            animal.age += dt;
            animal.decision -= dt;
            if (animal.decision <= 0) {
                const a = this.random() * Math.PI * 2;
                animal.dx = Math.cos(a); animal.dy = Math.sin(a); animal.decision = 1 + this.random() * 3;
            }
            if (['wolf', 'bear'].includes(animal.species)) {
                let prey = null, nearest = animal.species === 'bear' ? 6 : 10;
                for (const other of this.animals) if (['sheep', 'deer', 'rabbit', 'chicken'].includes(other.species) && other.health > 0) {
                    const d = Math.hypot(other.x - animal.x, other.y - animal.y);
                    if (d < nearest) { prey = other; nearest = d; }
                }
                if (prey) {
                    const a = Math.atan2(prey.y - animal.y, prey.x - animal.x);
                    animal.dx = Math.cos(a); animal.dy = Math.sin(a);
                    if (nearest < 1) { prey.health -= dt * 35; animal.health = Math.min(100, animal.health + dt * 5); }
                } else if (animal.species === 'wolf') animal.health -= dt * 0.1;
            } else if (['sheep', 'deer', 'rabbit', 'chicken'].includes(animal.species) && this.tile(animal.x, animal.y) === T.GRASS) animal.health = Math.min(100, animal.health + dt);
            if (animal.infection > 0) { animal.infection = Math.max(0, animal.infection - dt * 0.025); animal.health -= dt * 3; if (this.random() < dt * 0.08) { const nearby = this.animals.find(q => q !== animal && Math.hypot(q.x - animal.x, q.y - animal.y) < 2); if (nearby) nearby.infection = 1; } }
            this.move(animal, dt, animal.species === 'wolf' || animal.species === 'bear' ? 1.7 : animal.species === 'rabbit' ? 1.5 : 0.7);
            if (this.fire[this.index(animal.x, animal.y)] > 0) animal.health -= dt * 45;
            if (animal.age > 450) animal.health -= dt;
        }
        for (const v of this.villages) {
            if (!v.alive) continue;
            v.age += dt; v.birth_timer += dt; v.expansion_timer += dt;
            const pop = this.people.filter(p => p.village_id === v.id).length;
            const house_cost = v.race === 'dwarf' ? 4 : 5;
            if (v.expansion_timer > 10 && v.wood >= house_cost && v.houses.length < Math.ceil(pop / 3) + 1) {
                v.expansion_timer = 0;
                if (this.add_house(v)) v.wood -= house_cost;
            }
            const birth_delay = v.race === 'orc' ? 8 : 12;
            if (v.birth_timer > birth_delay && pop >= 2 && v.food > 8 && pop < v.houses.length * 5 && this.people.length < this.max_people) {
                const p = this.land_near(v.x, v.y, 4);
                if (p && this.add_person(p.x, p.y, v.id, v.race)) { v.food -= 5; v.birth_timer = 0; }
            }
            // Neighbouring kingdoms trade in peace, or raid while at war.
            if (this.tick % 240 === 0) {
                for (const other of this.villages) {
                    if (!other.alive || other.id <= v.id || Math.hypot(v.x - other.x, v.y - other.y) > 24) continue;
                    const relation = this.relation_status(v.id, other.id);
                    if (relation === 'alliance' || (relation === 'peace' && this.random() < 0.35)) {
                        v.food += relation === 'alliance' ? 7 : 5;
                        other.wood += relation === 'alliance' ? 5 : 3;
                        this.log(`${v.name} and ${other.name} exchange supplies.`, 'village');
                    } else if (relation === 'war') {
                        const victim = this.people.find(p => p.village_id === other.id);
                        if (victim) victim.health -= v.race === 'orc' ? 55 : 35;
                        this.log(`A border raid unsettles ${other.name}.`, 'disaster');
                    }
                }
            }
        }
        // Sample ecological growth; active fires are updated together to keep spread rate stable.
        for (let n = 0; n < 80; n++) {
            const i = Math.floor(this.random() * this.tiles.length), t = this.tiles[i];
            if (t === T.GRASS && this.fertility[i] > 0.6 && this.random() < dt * 0.25) {
                const x = i % WIDTH, y = Math.floor(i / WIDTH);
                if (DIRECTIONS.some(([dx, dy]) => this.tile(x + dx, y + dy) === T.FOREST)) { this.tiles[i] = T.FOREST; this.revision++; }
            }
            if (t === T.ASH && this.random() < dt * 0.07) { this.tiles[i] = T.GRASS; this.revision++; }
            if (t === T.LAVA && this.random() < dt * 0.14) { this.tiles[i] = T.ASH; this.revision++; }
        }
        const ignite = [];
        for (let i = 0; i < this.fire.length; i++) {
            if (this.fire[i] <= 0) continue;
            this.fire[i] -= dt;
            if (this.fire[i] <= 0) { this.tiles[i] = T.ASH; this.revision++; continue; }
            if (this.random() < dt * 0.45) {
                const [dx, dy] = DIRECTIONS[Math.floor(this.random() * 4)];
                const x = i % WIDTH + dx, y = Math.floor(i / WIDTH) + dy;
                const t = this.tile(x, y), j = this.index(x, y);
                if (this.inside(x, y) && (t === T.FOREST || t === T.GRASS) && !this.fire[j]) ignite.push(j);
            }
        }
        for (const i of ignite) this.fire[i] = 8 + this.random() * 8;
        if (this.tick % 20 === 0) {
            this.clean_up();
            if (this.animals.length < 240 && this.random() < 0.25) {
                const parent = this.animals[Math.floor(this.random() * this.animals.length)];
                if (parent && ['sheep', 'deer', 'rabbit', 'chicken'].includes(parent.species) && parent.age > 15) this.add_animal(parent.x, parent.y, parent.species);
            }
        }
        for (const effect of this.effects) effect.life -= dt / effect.duration;
        this.effects = this.effects.filter(e => e.life > 0);
    }
    stats() {
        let trees = 0, land = 0;
        for (const t of this.tiles) { if (t === T.FOREST) trees++; if (t > T.SHALLOW) land++; }
        return { population: this.people.length, wildlife: this.animals.length, villages: this.villages.filter(v => v.alive).length, trees, land: Math.round(land / this.tiles.length * 100) };
    }
    serialize() {
        return { format: 'genesis-grove', version: 1, name: this.name, seed: this.seed, rng: this.rng, time: this.time, tick: this.tick, next_id: this.next_id, scenario: this.scenario, year_length: this.year_length, laws: { ...this.laws }, milestone: this.milestone, tiles: Array.from(this.tiles), fire: Array.from(this.fire), fertility: Array.from(this.fertility), people: structuredClone(this.people), animals: structuredClone(this.animals), villages: structuredClone(this.villages), relations: structuredClone(this.relations), events: structuredClone(this.events) };
    }
    static deserialize(data) {
        const invalid = () => { throw new Error('This is not a valid Genesis Grove world file.'); };
        const num = (v, min = 0, max = 1e9) => Number.isFinite(v) && v >= min && v <= max;
        const integer = (v, min, max) => Number.isInteger(v) && num(v, min, max);
        const point = p => p && num(p.x, 0, WIDTH - 0.00001) && num(p.y, 0, HEIGHT - 0.00001);
        const array = (a, limit) => Array.isArray(a) && a.length <= limit;
        if (!data || data.format !== 'genesis-grove' || data.version !== 1 || typeof data.name !== 'string' || !data.name.trim() || data.name.length > 40 || typeof data.seed !== 'string' || data.seed.length > 100) invalid();
        const size = WIDTH * HEIGHT;
        if (!array(data.tiles, size) || data.tiles.length !== size || !data.tiles.every(t => integer(t, 0, 8))) invalid();
        if (!array(data.fire, size) || data.fire.length !== size || !data.fire.every(n => num(n, -0.25, 60))) invalid();
        if (!array(data.fertility, size) || data.fertility.length !== size || !data.fertility.every(n => num(n, 0, 1))) invalid();
        if (!num(data.time) || !integer(data.tick, 0, 1e10) || !integer(data.rng, 1, 4294967295) || !integer(data.next_id, 1, 1e9)) invalid();
        if (!array(data.villages, MAX_VILLAGES) || !array(data.people, MAX_PEOPLE) || !array(data.animals, 350) || !array(data.events, 40) || (data.relations !== undefined && !array(data.relations, 2000))) invalid();
        if (data.scenario !== undefined && !['sandbox', 'hundred'].includes(data.scenario)) invalid();
        if (data.year_length !== undefined && ![2, 20].includes(data.year_length)) invalid();
        if (data.laws !== undefined && (!data.laws || typeof data.laws.rebellions !== 'boolean' || typeof data.laws.diplomacy !== 'boolean')) invalid();
        if (data.milestone !== undefined && !integer(data.milestone, 0, 4)) invalid();
        const ids = new Set();
        const id = v => { if (!integer(v, 1, data.next_id - 1) || ids.has(v)) invalid(); ids.add(v); };
        for (const v of data.villages) {
            if (!point(v) || typeof v.name !== 'string' || v.name.length > 40 || !/^#[0-9a-f]{6}$/i.test(v.color) || typeof v.alive !== 'boolean' || !array(v.houses, 220) || !v.houses.every(point) || (v.race !== undefined && !RACES[v.race])) invalid();
            if (!['food', 'wood', 'age', 'birth_timer', 'expansion_timer'].every(k => num(v[k]))) invalid();
            id(v.id);
        }
        const villages = new Set(data.villages.map(v => v.id));
        for (const u of [...data.people, ...data.animals]) {
            if (!point(u) || !num(u.health, -1000, 100) || !num(u.age) || !num(u.dx, -1, 1) || !num(u.dy, -1, 1) || !num(u.decision, -0.25, 10)) invalid();
            id(u.id);
        }
        for (const p of data.people) if (!villages.has(p.village_id) || !num(p.gather, 0, 10) || (p.race !== undefined && !RACES[p.race]) || (p.infection !== undefined && !num(p.infection, 0, 1))) invalid();
        for (const a of data.animals) if (!['sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken'].includes(a.species) || (a.infection !== undefined && !num(a.infection, 0, 1))) invalid();
        for (const e of data.events) if (!e || typeof e.text !== 'string' || e.text.length > 300 || !integer(e.year, 1, 1e9) || !['life', 'creation', 'village', 'disaster'].includes(e.kind)) invalid();
        const relation_keys = new Set();
        for (const r of data.relations || []) {
            if (!r || !integer(r.a, 1, data.next_id - 1) || !integer(r.b, 1, data.next_id - 1) || r.a >= r.b || !villages.has(r.a) || !villages.has(r.b) || !['peace', 'alliance', 'war'].includes(r.status) || relation_keys.has(`${r.a}:${r.b}`)) invalid();
            relation_keys.add(`${r.a}:${r.b}`);
        }
        const w = new World({ preset: 'empty', inhabited: false });
        for (const k of ['name', 'seed', 'rng', 'time', 'tick', 'next_id', 'people', 'animals', 'villages', 'events']) w[k] = structuredClone(data[k]);
        w.relations = structuredClone(data.relations || []);
        w.scenario = data.scenario || 'sandbox';
        w.year_length = data.year_length || 20;
        w.laws = data.laws ? { ...data.laws } : { rebellions: false, diplomacy: false };
        w.milestone = data.milestone || 0;
        for (const p of w.people) { p.race ||= 'human'; p.infection ||= 0; }
        for (const a of w.animals) a.infection ||= 0;
        for (const v of w.villages) v.race ||= 'human';
        w.tiles = Uint8Array.from(data.tiles); w.fire = Float32Array.from(data.fire); w.fertility = Float32Array.from(data.fertility);
        return w;
    }
}
