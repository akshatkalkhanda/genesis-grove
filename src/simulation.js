export const WIDTH = 192;
export const HEIGHT = 128;
export const T = Object.freeze({ OCEAN: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, HILL: 5, MOUNTAIN: 6, LAVA: 7, ASH: 8 });
export const TERRAIN_NAMES = ['Deep ocean', 'Shallow water', 'Sand', 'Meadow', 'Forest', 'Highlands', 'Mountain', 'Lava', 'Ash'];
export const CIV_COLORS = ['#e9c87b', '#b9a4e6', '#e58f83', '#83c5cd', '#c3da89', '#efb6d0', '#95acdf', '#dfae76'];
const NAMES = ['Amberwick', 'Willowmere', 'Rosehaven', 'Tidewatch', 'Mossvale', 'Sunhollow', 'Briarford', 'Cloudrest'];
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
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
    constructor({ seed = 'emerald-17', name = 'The Emerald Isles', preset = 'islands', inhabited = true } = {}) {
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
        this.events = [];
        this.effects = [];
        this.revision = 1;
        this.generate(preset);
        this.log('A new world awakens. What will you make of it?', 'creation');
        if (inhabited && preset !== 'empty') this.seed_life();
    }
    random() {
        let x = this.rng;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        this.rng = x >>> 0;
        return this.rng / 4294967296;
    }
    get year() { return Math.floor(this.time / 20) + 1; }
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
    found_village(x, y) {
        if (this.villages.length >= 8) return this.villages.reduce((a, b) => Math.hypot(a.x - x, a.y - y) < Math.hypot(b.x - x, b.y - y) ? a : b);
        const n = this.villages.length;
        const village = { id: this.next_id++, x, y, name: NAMES[n], color: CIV_COLORS[n], food: 35, wood: 15, age: 0, birth_timer: 0, expansion_timer: 0, houses: [], alive: true };
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
    add_person(x, y, village_id = null) {
        if (!this.walkable(x, y) || this.people.length >= 600) return false;
        if (!village_id) {
            let nearest = this.villages.filter(v => v.alive).find(v => Math.hypot(v.x - x, v.y - y) < 22);
            nearest ||= this.found_village(x, y);
            nearest.alive = true;
            village_id = nearest.id;
        }
        this.people.push({ id: this.next_id++, x, y, village_id, health: 100, age: 0, dx: 0, dy: 0, decision: this.random(), gather: this.random() * 3 });
        return true;
    }
    add_animal(x, y, species) {
        if (!this.walkable(x, y) || this.animals.length >= 350) return false;
        this.animals.push({ id: this.next_id++, x, y, species, health: 100, age: 0, dx: 0, dy: 0, decision: 0 });
        return true;
    }
    apply(tool, x, y, radius = 4) {
        x = Math.floor(x); y = Math.floor(y);
        if (!this.inside(x, y)) return;
        const terrain = { ocean: T.OCEAN, shallow: T.SHALLOW, sand: T.SAND, grass: T.GRASS, forest: T.FOREST, hill: T.HILL, mountain: T.MOUNTAIN, lava: T.LAVA };
        if (tool === 'human' || tool === 'sheep' || tool === 'wolf') {
            if (!this.walkable(x, y)) return;
            if (tool === 'human') {
                for (let i = 0; i < 3; i++) {
                    const p = this.land_near(x, y, Math.max(1, radius / 2));
                    if (p) this.add_person(p.x, p.y);
                }
            } else this.add_animal(x + 0.5, y + 0.5, tool);
            return;
        }
        const r = tool === 'meteor' ? radius + 2 : radius;
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
            if (tool === 'meteor' && t > T.SHALLOW) {
                this.set_tile(x + dx, y + dy, dx * dx + dy * dy < r * r * 0.2 ? T.LAVA : T.ASH);
                this.fire[i] = 0;
            }
            if (tool === 'lightning' && Math.abs(dx) + Math.abs(dy) < 3 && t >= T.GRASS && t <= T.HILL) this.fire[i] = 12;
        }
        if (['meteor', 'lightning', 'rain', 'bless'].includes(tool)) {
            this.effects.push({ type: tool, x, y, radius: r, life: 1, duration: tool === 'rain' ? 1.5 : 0.8 });
        }
        if (tool === 'meteor') this.log('A star falls. The earth will remember.', 'disaster');
        if (tool === 'lightning') this.log('Thunder breaks the quiet.', 'disaster');
        const damage = tool === 'meteor' ? 200 : tool === 'lightning' ? 75 : tool === 'erase' ? 1000 : 0;
        for (const list of [this.people, this.animals]) for (const unit of list) {
            if (Math.hypot(unit.x - x, unit.y - y) > r) continue;
            unit.health -= damage;
            if (tool === 'bless') unit.health = 100;
        }
        if (tool === 'meteor' || tool === 'erase') for (const v of this.villages) {
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
    step(dt) {
        dt = clamp(dt, 0, 0.25);
        this.time += dt;
        this.tick++;
        for (const p of this.people) {
            p.age += dt;
            p.decision -= dt;
            p.gather += dt;
            const v = this.villages.find(v => v.id === p.village_id);
            if (p.decision <= 0) {
                let a = this.random() * Math.PI * 2;
                if (v && Math.hypot(p.x - v.x, p.y - v.y) > 9 + Math.sqrt(v.houses.length)) a = Math.atan2(v.y - p.y, v.x - p.x);
                p.dx = Math.cos(a); p.dy = Math.sin(a); p.decision = 0.5 + this.random() * 3;
            }
            this.move(p, dt, 1.3);
            const i = this.index(p.x, p.y);
            if (this.fire[i] > 0) p.health -= dt * 38;
            if (p.age > 700) p.health -= dt * 2;
            if (v && p.gather >= 3) {
                p.gather = 0;
                v.food += this.tiles[i] === T.GRASS || this.tiles[i] === T.FOREST ? this.fertility[i] * 2.4 : 0.4;
                if (this.tiles[i] === T.FOREST) v.wood += 1;
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
            if (animal.species === 'wolf') {
                let prey = null, nearest = 10;
                for (const other of this.animals) if (other.species === 'sheep' && other.health > 0) {
                    const d = Math.hypot(other.x - animal.x, other.y - animal.y);
                    if (d < nearest) { prey = other; nearest = d; }
                }
                if (prey) {
                    const a = Math.atan2(prey.y - animal.y, prey.x - animal.x);
                    animal.dx = Math.cos(a); animal.dy = Math.sin(a);
                    if (nearest < 1) { prey.health -= dt * 35; animal.health = Math.min(100, animal.health + dt * 5); }
                } else animal.health -= dt * 0.1;
            } else if (this.tile(animal.x, animal.y) === T.GRASS) animal.health = Math.min(100, animal.health + dt);
            this.move(animal, dt, animal.species === 'wolf' ? 2 : 0.7);
            if (this.fire[this.index(animal.x, animal.y)] > 0) animal.health -= dt * 45;
            if (animal.age > 450) animal.health -= dt;
        }
        for (const v of this.villages) {
            if (!v.alive) continue;
            v.age += dt; v.birth_timer += dt; v.expansion_timer += dt;
            const pop = this.people.filter(p => p.village_id === v.id).length;
            if (v.expansion_timer > 10 && v.wood >= 5 && v.houses.length < Math.ceil(pop / 3) + 1) {
                v.expansion_timer = 0;
                if (this.add_house(v)) v.wood -= 5;
            }
            if (v.birth_timer > 12 && pop >= 2 && v.food > 8 && pop < v.houses.length * 5 && this.people.length < 600) {
                const p = this.land_near(v.x, v.y, 4);
                if (p && this.add_person(p.x, p.y, v.id)) { v.food -= 5; v.birth_timer = 0; }
            }
            // Distant settlements remain peaceful. Overlapping frontiers create trade or raids.
            if (this.tick % 240 === 0) {
                for (const other of this.villages) {
                    if (!other.alive || other.id <= v.id || Math.hypot(v.x - other.x, v.y - other.y) > 24) continue;
                    if (this.random() < 0.65) {
                        v.food += 5; other.wood += 3;
                        this.log(`${v.name} and ${other.name} exchange supplies.`, 'village');
                    } else {
                        const victim = this.people.find(p => p.village_id === other.id);
                        if (victim) victim.health -= 45;
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
                if (parent?.species === 'sheep' && parent.age > 15) this.add_animal(parent.x, parent.y, 'sheep');
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
        return { format: 'genesis-grove', version: 1, name: this.name, seed: this.seed, rng: this.rng, time: this.time, tick: this.tick, next_id: this.next_id, tiles: Array.from(this.tiles), fire: Array.from(this.fire), fertility: Array.from(this.fertility), people: structuredClone(this.people), animals: structuredClone(this.animals), villages: structuredClone(this.villages), events: structuredClone(this.events) };
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
        if (!array(data.villages, 8) || !array(data.people, 600) || !array(data.animals, 350) || !array(data.events, 40)) invalid();
        const ids = new Set();
        const id = v => { if (!integer(v, 1, data.next_id - 1) || ids.has(v)) invalid(); ids.add(v); };
        for (const v of data.villages) {
            if (!point(v) || typeof v.name !== 'string' || v.name.length > 40 || !CIV_COLORS.includes(v.color) || typeof v.alive !== 'boolean' || !array(v.houses, 220) || !v.houses.every(point)) invalid();
            if (!['food', 'wood', 'age', 'birth_timer', 'expansion_timer'].every(k => num(v[k]))) invalid();
            id(v.id);
        }
        const villages = new Set(data.villages.map(v => v.id));
        for (const u of [...data.people, ...data.animals]) {
            if (!point(u) || !num(u.health, -1000, 100) || !num(u.age) || !num(u.dx, -1, 1) || !num(u.dy, -1, 1) || !num(u.decision, -0.25, 10)) invalid();
            id(u.id);
        }
        for (const p of data.people) if (!villages.has(p.village_id) || !num(p.gather, 0, 10)) invalid();
        for (const a of data.animals) if (!['sheep', 'wolf'].includes(a.species)) invalid();
        for (const e of data.events) if (!e || typeof e.text !== 'string' || e.text.length > 300 || !integer(e.year, 1, 1e9) || !['life', 'creation', 'village', 'disaster'].includes(e.kind)) invalid();
        const w = new World({ preset: 'empty', inhabited: false });
        for (const k of ['name', 'seed', 'rng', 'time', 'tick', 'next_id', 'people', 'animals', 'villages', 'events']) w[k] = structuredClone(data[k]);
        w.tiles = Uint8Array.from(data.tiles); w.fire = Float32Array.from(data.fire); w.fertility = Float32Array.from(data.fertility);
        return w;
    }
}
