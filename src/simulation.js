export const WIDTH = 192;
export const HEIGHT = 128;
export const T = Object.freeze({ OCEAN: 0, SHALLOW: 1, SAND: 2, GRASS: 3, FOREST: 4, HILL: 5, MOUNTAIN: 6, LAVA: 7, ASH: 8 });
export const TERRAIN_NAMES = ['Deep ocean', 'Shallow water', 'Sand', 'Meadow', 'Forest', 'Highlands', 'Mountain', 'Lava', 'Ash'];
export const ORES = Object.freeze({ copper: 1, tin: 2, iron: 3, coal: 4 });
export const ORE_NAMES = Object.freeze(['None', 'Copper ore', 'Tin ore', 'Iron ore', 'Coal']);
export const TECH_AGES = Object.freeze([
    { name: 'Stone Age', threshold: 0, weapon: 'Stone club', color: '#b2a18a' },
    { name: 'Copper Age', threshold: 8, weapon: 'Copper spear', color: '#e59b65' },
    { name: 'Bronze Age', threshold: 22, weapon: 'Bronze blade', color: '#e2bd70' },
    { name: 'Iron Age', threshold: 50, weapon: 'Iron sword', color: '#aab8c4' },
    { name: 'Steel Age', threshold: 100, weapon: 'Steel sword', color: '#85d9e2' }
]);
export function technology_level(kingdom) {
    if (Number.isInteger(kingdom?.research_level)) return clamp(kingdom.research_level, 0, TECH_AGES.length - 1);
    const points = kingdom?.tech_points || 0;
    for (let i = TECH_AGES.length - 1; i >= 0; i--) if (points >= TECH_AGES[i].threshold) return i;
    return 0;
}
export const CIV_COLORS = ['#e9c87b', '#b9a4e6', '#e58f83', '#83c5cd', '#c3da89', '#efb6d0', '#95acdf', '#dfae76'];
const NAMES = ['Amberwick', 'Willowmere', 'Rosehaven', 'Tidewatch', 'Mossvale', 'Sunhollow', 'Briarford', 'Cloudrest'];
const MAX_VILLAGES = 120;
const MAX_PEOPLE = 1200;
const MAX_COLONIES = 240;
const MAX_VOYAGES = 40;
const MAX_TRADES = 60;
export const JOBS = Object.freeze(['farmer', 'lumberjack', 'miner', 'smith', 'builder']);
const RACES = Object.freeze({ human: { label: 'Human', color: '#e9c87b' }, elf: { label: 'Elven', color: '#9bcf91' }, dwarf: { label: 'Dwarven', color: '#d5a776' }, orc: { label: 'Orcish', color: '#a9bd77' } });
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function kingdom_color(index) {
    const first = ['#f07165', '#65d58c', '#7ca9ef', '#e8bf62', '#bc89e8', '#63d2d3', '#ee82b5', '#de996d'];
    if (index < first.length) return first[index];
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
        this.ores = new Uint8Array(WIDTH * HEIGHT);
        this.fire = new Float32Array(WIDTH * HEIGHT);
        this.fertility = new Float32Array(WIDTH * HEIGHT).fill(0.8);
        this.people = [];
        this.animals = [];
        this.villages = [];
        this.colonies = [];
        this.voyages = [];
        this.trades = [];
        this.armies = [];
        this.relations = [];
        this.scenario = scenario === 'hundred' ? 'hundred' : 'sandbox';
        this.year_length = this.scenario === 'hundred' ? 2 : 20;
        this.laws = { rebellions: false, diplomacy: this.scenario === 'hundred', expansion: this.scenario === 'hundred' };
        this.milestone = 0;
        this.events = [];
        this.effects = [];
        this.revision = 1;
        const landscape = this.scenario === 'hundred' ? 'fractured' : preset;
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
            if (preset === 'fractured') {
                const lobes = [[-0.55, -0.48, 0.68, 0.5], [0.54, -0.45, 0.63, 0.53], [-0.5, 0.5, 0.67, 0.5], [0.57, 0.49, 0.61, 0.48]];
                const land = Math.max(0, ...lobes.map(([cx, cy, rx, ry]) => 1 - ((nx - cx) / rx) ** 2 - ((ny - cy) / ry) ** 2));
                const fault = Math.abs(nx + 0.05 * Math.sin(ny * 9 + seed)) < 0.025 ? 0.18 : 0;
                h = 0.12 + land * 0.36 + broad * 0.24 + detail * 0.16 + fine * 0.08 - fault;
            }
            let t = h < 0.39 ? T.OCEAN : h < 0.445 ? T.SHALLOW : h < 0.478 ? T.SAND : h < 0.65 ? T.GRASS : h < 0.73 ? T.HILL : T.MOUNTAIN;
            if (t === T.GRASS && noise(x / 8, y / 8, seed + 51) > 0.48 && this.random() > 0.2) t = T.FOREST;
            this.tiles[this.index(x, y)] = t;
            if (t >= T.HILL && this.random() < 0.24) this.ores[this.index(x, y)] = 1 + Math.floor(this.random() * 4);
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
        const color = kingdom_color(n);
        const village = { id: this.next_id++, x, y, race, name: `${profile.label} ${name}`, color, food: 35, wood: 15, age: 0, birth_timer: 0, expansion_timer: 0, ore: { copper: 0, tin: 0, iron: 0, coal: 0 }, weapons: 0, armor_stock: 0, mine_timer: 0, forge_timer: 0, training_timer: 0, barracks: 0, mine_level: 0, forge_level: 0, research_level: 0, tech_points: 0, houses: [], alive: true, founded_year: this.year, deaths: 0, siege: 0 };
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
    settlements_of(kingdom_id) {
        const capital = this.villages.find(v => v.id === kingdom_id && v.alive);
        return capital ? [capital, ...this.colonies.filter(c => c.kingdom_id === kingdom_id)] : [];
    }
    claim_sites() {
        const living = new Set(this.villages.filter(v => v.alive).map(v => v.id));
        return [...this.villages.filter(v => v.alive), ...this.colonies.filter(c => living.has(c.kingdom_id))]
            .map(site => ({ id: site.kingdom_id || site.id, x: site.x, y: site.y,
                radius: Math.min(17, (site.kingdom_id ? 6 : 9) + site.houses.length * 0.65) }));
    }
    territory_at(x, y, sites = null) {
        if (!this.walkable(x, y)) return null;
        let owner = null, nearest = Infinity;
        for (const site of sites || this.claim_sites()) {
            const distance = (site.x - x) ** 2 + (site.y - y) ** 2;
            if (distance <= site.radius ** 2 && distance < nearest) {
                owner = site.id; nearest = distance;
            }
        }
        return owner;
    }
    found_colony(kingdom_id, x, y) {
        const kingdom = this.villages.find(v => v.id === kingdom_id && v.alive);
        if (!kingdom || !this.walkable(x, y) || this.colonies.length >= MAX_COLONIES) return null;
        const count = this.colonies.filter(c => c.kingdom_id === kingdom_id).length + 1;
        const colony = { id: this.next_id++, kingdom_id, x, y, name: `${kingdom.name} ${count}`, houses: [], age: 0, birth_timer: 0, expansion_timer: 0, siege: 0 };
        this.colonies.push(colony);
        this.add_house(colony);
        this.log(`${kingdom.name} establishes ${colony.name}.`, 'village');
        return colony;
    }
    landmasses() {
        const labels = new Int16Array(this.tiles.length).fill(-1);
        const queue = new Int32Array(this.tiles.length);
        let label = 0;
        for (let start = 0; start < labels.length; start++) {
            if (labels[start] !== -1 || !this.walkable(start % WIDTH, Math.floor(start / WIDTH))) continue;
            let head = 0, tail = 1;
            queue[0] = start; labels[start] = label;
            while (head < tail) {
                const i = queue[head++], x = i % WIDTH, y = Math.floor(i / WIDTH);
                for (const [dx, dy] of DIRECTIONS) {
                    const nx = x + dx, ny = y + dy;
                    if (!this.inside(nx, ny)) continue;
                    const j = ny * WIDTH + nx;
                    if (labels[j] === -1 && this.walkable(nx, ny)) { labels[j] = label; queue[tail++] = j; }
                }
            }
            label++;
        }
        return labels;
    }
    launch_colony(kingdom_id, x, y, labels = null) {
        const kingdom = this.villages.find(v => v.id === kingdom_id && v.alive);
        if (!kingdom || !this.walkable(x, y) || this.voyages.length >= MAX_VOYAGES || this.colonies.length >= MAX_COLONIES || kingdom.food < 10 || kingdom.wood < 6) return false;
        const sites = [...this.villages.filter(v => v.alive), ...this.colonies];
        if (sites.some(site => Math.hypot(site.x - x, site.y - y) < 7)) return false;
        const crew = this.people.filter(p => p.village_id === kingdom_id && !p.voyage_id && p.role !== 'soldier' && p.age > 5).slice(0, 3);
        if (crew.length < 3) return false;
        const source = this.settlements_of(kingdom_id).find(site => crew.some(p => p.home_id === site.id)) || kingdom;
        const masses = labels || this.landmasses();
        const ship = masses[this.index(source.x, source.y)] !== masses[this.index(x, y)];
        const voyage = { id: this.next_id++, kingdom_id, x: source.x, y: source.y, target_x: x, target_y: y, progress: 0, duration: Math.max(5, Math.hypot(x - source.x, y - source.y) / (ship ? 3 : 5)), kind: ship ? 'ship' : 'caravan', crew_ids: crew.map(p => p.id) };
        this.voyages.push(voyage);
        for (const person of crew) person.voyage_id = voyage.id;
        kingdom.food -= 10; kingdom.wood -= 6;
        this.log(`${kingdom.name} sends ${ship ? 'a ship' : 'settlers'} toward new land.`, 'village');
        return true;
    }
    advance_voyages(dt) {
        for (const voyage of this.voyages) {
            voyage.progress = Math.min(1, voyage.progress + dt / voyage.duration);
            if (voyage.progress < 1) continue;
            const kingdom = this.villages.find(v => v.id === voyage.kingdom_id && v.alive);
            const crew = this.people.filter(p => voyage.crew_ids.includes(p.id));
            const occupied = [...this.villages.filter(v => v.alive), ...this.colonies]
                .some(site => Math.hypot(site.x - voyage.target_x, site.y - voyage.target_y) < 7);
            const colony = kingdom && !occupied && this.walkable(voyage.target_x, voyage.target_y)
                ? this.found_colony(kingdom.id, voyage.target_x, voyage.target_y) : null;
            for (const person of crew) {
                person.voyage_id = null;
                person.x = colony ? colony.x : kingdom?.x ?? person.x;
                person.y = colony ? colony.y : kingdom?.y ?? person.y;
                if (colony) person.home_id = colony.id;
            }
        }
        this.voyages = this.voyages.filter(v => v.progress < 1);
    }
    resource_amount(kingdom, good) {
        return good === 'food' || good === 'wood' ? kingdom[good] : kingdom.ore[good];
    }
    change_resource(kingdom, good, amount) {
        if (good === 'food' || good === 'wood') kingdom[good] += amount;
        else kingdom.ore[good] += amount;
    }
    launch_trade(sender, recipient, good, amount, masses) {
        if (!sender?.alive || !recipient?.alive || sender.id === recipient.id || this.trades.length >= MAX_TRADES || this.relation_status(sender.id, recipient.id) === 'war' || this.resource_amount(sender, good) < amount) return false;
        const distance = Math.hypot(sender.x - recipient.x, sender.y - recipient.y);
        const kind = masses[this.index(sender.x, sender.y)] === masses[this.index(recipient.x, recipient.y)] ? 'caravan' : 'ship';
        this.change_resource(sender, good, -amount);
        this.trades.push({ id: this.next_id++, from_id: sender.id, to_id: recipient.id, good, amount, progress: 0, duration: Math.max(6, distance / (kind === 'ship' ? 3 : 5)), kind });
        this.log(`${sender.name} sends ${amount} ${good} to ${recipient.name} by ${kind}.`, 'village');
        return true;
    }
    schedule_trades() {
        const kingdoms = this.villages.filter(v => v.alive);
        if (!kingdoms.length) return;
        const offset = Math.floor(this.tick / 240) % kingdoms.length;
        const order = kingdoms.slice(offset).concat(kingdoms.slice(0, offset));
        const dispatched = new Set();
        let masses = null, launched = 0;
        for (const first of order) for (const second of order) {
            if (launched >= 6) return;
            if (first.id === second.id || dispatched.has(first.id) || dispatched.has(second.id) || Math.hypot(first.x - second.x, first.y - second.y) > 42 || this.relation_status(first.id, second.id) === 'war') continue;
            if (this.trades.some(t => (t.from_id === first.id && t.to_id === second.id) || (t.from_id === second.id && t.to_id === first.id))) continue;
            const options = [['food', 30, 8, 6], ['wood', 14, 6, 4], ['copper', 5, 3, 2], ['tin', 5, 3, 2], ['iron', 5, 3, 2], ['coal', 5, 3, 2]];
            for (const [good, minimum, gap, amount] of options) {
                const a = this.resource_amount(first, good), b = this.resource_amount(second, good);
                const sender = a > b ? first : second, recipient = a > b ? second : first;
                if (Math.max(a, b) < minimum || Math.abs(a - b) < gap) continue;
                masses ||= this.landmasses();
                if (this.launch_trade(sender, recipient, good, amount, masses)) { dispatched.add(first.id); dispatched.add(second.id); launched++; }
                break;
            }
        }
    }
    advance_trades(dt) {
        for (const trade of this.trades) {
            const sender = this.villages.find(v => v.id === trade.from_id && v.alive);
            const recipient = this.villages.find(v => v.id === trade.to_id && v.alive);
            if (!recipient || this.relation_status(trade.from_id, trade.to_id) === 'war') {
                if (sender) this.change_resource(sender, trade.good, trade.amount);
                trade.progress = 1;
                continue;
            }
            trade.progress = Math.min(1, trade.progress + dt / trade.duration);
            if (trade.progress === 1) {
                this.change_resource(recipient, trade.good, trade.amount);
                this.log(`${recipient.name} receives ${trade.amount} ${trade.good} from ${sender?.name || 'a lost kingdom'}.`, 'village');
            }
        }
        this.trades = this.trades.filter(trade => trade.progress < 1);
    }
    conquer_site(site, attacker_id) {
        const attacker = this.villages.find(v => v.id === attacker_id && v.alive);
        const defender = this.villages.find(v => v.id === (site.kingdom_id || site.id) && v.alive);
        if (!attacker || !defender || attacker.id === defender.id) return false;
        if (site.kingdom_id) {
            site.kingdom_id = attacker.id;
            site.siege = 0;
            for (const person of this.people) if (person.village_id === defender.id) {
                if (person.voyage_id && person.home_id === site.id) person.home_id = defender.id;
                else if (!person.voyage_id && (person.home_id === site.id || Math.hypot(person.x - site.x, person.y - site.y) < 7)) {
                    person.village_id = attacker.id; person.home_id = site.id;
                }
            }
            this.log(`${attacker.name} captures ${site.name} from ${defender.name}.`, 'disaster');
        } else {
            if (this.colonies.length >= MAX_COLONIES) return false;
            const captured = { id: this.next_id++, kingdom_id: attacker.id, x: site.x, y: site.y, name: site.name, houses: structuredClone(site.houses), age: site.age, birth_timer: 0, expansion_timer: 0, siege: 0 };
            this.colonies.push(captured);
            for (const colony of this.colonies) if (colony.kingdom_id === defender.id) colony.kingdom_id = attacker.id;
            for (const voyage of this.voyages) if (voyage.kingdom_id === defender.id) voyage.kingdom_id = attacker.id;
            for (const person of this.people) if (person.village_id === defender.id) {
                person.village_id = attacker.id;
                if (person.home_id === defender.id) person.home_id = captured.id;
            }
            defender.alive = false; defender.houses = []; defender.siege = 0;
            this.log(`${attacker.name} conquers ${defender.name} and its towns.`, 'disaster');
        }
        return true;
    }
    resolve_sieges() {
        if (this.tick % 8 !== 0) return;
        const enemies = new Map();
        for (const relation of this.relations) if (relation.status === 'war') {
            if (!enemies.has(relation.a)) enemies.set(relation.a, new Set());
            if (!enemies.has(relation.b)) enemies.set(relation.b, new Set());
            enemies.get(relation.a).add(relation.b);
            enemies.get(relation.b).add(relation.a);
        }
        if (!enemies.size) return;
        for (const site of [...this.villages.filter(v => v.alive), ...this.colonies]) {
            const owner = site.kingdom_id || site.id, rivals = enemies.get(owner);
            if (!rivals) continue;
            let defenders = 0;
            const attackers = new Map();
            for (const person of this.people) {
                if (person.voyage_id || person.role !== 'soldier' || person.health <= 0 || (person.x - site.x) ** 2 + (person.y - site.y) ** 2 > 36) continue;
                if (person.village_id === owner) defenders++;
                else if (rivals.has(person.village_id)) attackers.set(person.village_id, (attackers.get(person.village_id) || 0) + 1);
            }
            const [leader, count] = [...attackers].sort((a, b) => b[1] - a[1])[0] || [];
            site.siege = count >= 2 && count > defenders ? (site.siege || 0) + count - defenders : Math.max(0, (site.siege || 0) - 1);
            if (site.siege >= (site.kingdom_id ? 8 : 14)) this.conquer_site(site, leader);
        }
    }
    add_person(x, y, village_id = null, race = 'human') {
        if (!this.walkable(x, y) || this.people.length >= this.max_people) return false;
        if (!village_id) {
            let nearest = this.villages.filter(v => v.alive && v.race === race).find(v => Math.hypot(v.x - x, v.y - y) < 22);
            nearest ||= this.found_village(x, y, race);
            nearest.alive = true;
            village_id = nearest.id;
        }
        const residents = this.people.filter(p => p.village_id === village_id && p.role !== 'soldier').length;
        this.people.push({ id: this.next_id++, x, y, village_id, home_id: village_id, voyage_id: null, race: RACES[race] ? race : 'human', job: JOBS[residents % JOBS.length], role: 'civilian', health: 100, age: 0, dx: 0, dy: 0, decision: this.random(), gather: this.random() * 3, infection: 0, weapon_level: 0, armor_level: 0 });
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
        const ore_tool = ORES[tool];
        if (ore_tool) {
            for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radius * radius && this.inside(x + dx, y + dy)) this.ores[this.index(x + dx, y + dy)] = ore_tool;
            }
            this.revision++;
            return;
        }
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
            if (unit.voyage_id) continue;
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
        for (const person of this.people) if (person.health <= 0 || !this.walkable(person.x, person.y)) {
            const kingdom = this.villages.find(v => v.id === person.village_id);
            if (kingdom) kingdom.deaths = (kingdom.deaths || 0) + 1;
        }
        this.people = this.people.filter(p => p.health > 0 && this.walkable(p.x, p.y));
        const survivors = new Set(this.people.map(p => p.id));
        this.voyages = this.voyages.filter(voyage => {
            if (voyage.crew_ids.every(id => survivors.has(id))) return true;
            for (const person of this.people) if (person.voyage_id === voyage.id) person.voyage_id = null;
            return false;
        });
        this.animals = this.animals.filter(p => p.health > 0 && this.walkable(p.x, p.y));
        for (const v of this.villages) {
            v.houses = v.houses.filter(h => this.walkable(h.x, h.y) && this.fire[this.index(h.x, h.y)] < 5);
            if (v.alive && !this.people.some(p => p.village_id === v.id)) {
                v.alive = false;
                this.log(`${v.name} falls silent. Its story lives on.`, 'disaster');
            }
        }
        const living = new Set(this.villages.filter(v => v.alive).map(v => v.id));
        this.colonies = this.colonies.filter(c => living.has(c.kingdom_id));
    }
    move(unit, dt, speed) {
        const nx = clamp(unit.x + unit.dx * dt * speed, 0.5, WIDTH - 0.5);
        const ny = clamp(unit.y + unit.dy * dt * speed, 0.5, HEIGHT - 0.5);
        if (this.walkable(nx, ny)) { unit.x = nx; unit.y = ny; }
        else unit.decision = 0;
    }
    march(unit, target, dt, speed) {
        const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
        const side = unit.id % 2 ? 1 : -1;
        for (const offset of [0, side * 0.55, side * 1.1, side * 1.65, -side * 0.55, -side * 1.1, -side * 1.65]) {
            const dx = Math.cos(angle + offset), dy = Math.sin(angle + offset);
            const nx = unit.x + dx * dt * speed, ny = unit.y + dy * dt * speed;
            if (!this.walkable(nx, ny)) continue;
            unit.dx = dx; unit.dy = dy; this.move(unit, dt, speed); return;
        }
        unit.decision = 0;
    }
    plan_armies(war_targets) {
        const groups = new Map();
        for (const person of this.people) {
            if (person.role !== 'soldier' || person.voyage_id || person.health <= 0) continue;
            const key = person.home_id || person.village_id;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(person);
        }
        if (!this._army_masses || this.tick % 32 === 0) this._army_masses = this.landmasses();
        const sites = [...this.villages.filter(v => v.alive), ...this.colonies];
        const orders = new Map();
        this.armies = [];
        for (const [home_id, soldiers] of groups) {
            const kingdom_id = soldiers[0].village_id;
            const enemies = war_targets.get(kingdom_id);
            const x = soldiers.reduce((sum, p) => sum + p.x, 0) / soldiers.length;
            const y = soldiers.reduce((sum, p) => sum + p.y, 0) / soldiers.length;
            const landmass = this._army_masses[this.index(soldiers[0].x, soldiers[0].y)];
            let target = null, nearest = Infinity;
            if (enemies && landmass >= 0) for (const site of sites) {
                if (!enemies.has(site.kingdom_id || site.id) || this._army_masses[this.index(site.x, site.y)] !== landmass) continue;
                const distance = (site.x - x) ** 2 + (site.y - y) ** 2;
                if (distance < nearest) { nearest = distance; target = site; }
            }
            const order = { kingdom_id, home_id, x, y, count: soldiers.length,
                target_id: target?.id || null, target_name: target?.name || null,
                target_x: target?.x ?? null, target_y: target?.y ?? null };
            orders.set(home_id, order);
            this.armies.push(order);
        }
        return orders;
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
                    child.research_level = parent.research_level;
                    child.tech_points = parent.tech_points;
                    for (const person of rebels) person.village_id = child.id;
                    this.set_relation(parent.id, child.id, 'war');
                    this.log(`${child.name} breaks away from ${parent.name}.`, 'disaster');
                }
            }
        }
        if (this.laws.expansion && this.tick % 320 === 0 && this.colonies.length < MAX_COLONIES && this.voyages.length < MAX_VOYAGES) {
            const populations = new Map();
            for (const person of this.people) if (!person.voyage_id) populations.set(person.village_id, (populations.get(person.village_id) || 0) + 1);
            const choices = this.villages.filter(v => v.alive && (populations.get(v.id) || 0) >= 8 && v.food >= 20 && v.wood >= 12 && this.colonies.filter(c => c.kingdom_id === v.id).length < 4);
            const kingdom = choices[Math.floor(this.random() * choices.length)];
            if (kingdom) {
                const labels = this.landmasses();
                const sites = [...this.villages.filter(v => v.alive), ...this.colonies];
                const source_mass = labels[this.index(kingdom.x, kingdom.y)];
                let target = null;
                for (let attempt = 0; attempt < 250; attempt++) {
                    const x = 3 + Math.floor(this.random() * (WIDTH - 6));
                    const y = 3 + Math.floor(this.random() * (HEIGHT - 6));
                    if (!this.walkable(x, y) || Math.hypot(x - kingdom.x, y - kingdom.y) > 70 || sites.some(site => Math.hypot(site.x - x, site.y - y) < 7)) continue;
                    const candidate = { x, y };
                    if (labels[this.index(x, y)] !== source_mass) { target = candidate; break; }
                    target ||= candidate;
                }
                if (target) this.launch_colony(kingdom.id, target.x, target.y, labels);
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
        this.advance_voyages(dt);
        this.advance_trades(dt);
        this.resolve_sieges();
        const war_targets = new Map();
        for (const relation of this.relations) {
            if (relation.status !== 'war') continue;
            for (const [a, b] of [[relation.a, relation.b], [relation.b, relation.a]]) {
                if (!war_targets.has(a)) war_targets.set(a, new Set());
                war_targets.get(a).add(b);
            }
        }
        const army_orders = this.plan_armies(war_targets);
        const homes = new Map([...this.villages, ...this.colonies].map(site => [site.id, site]));
        for (const p of this.people) {
            if (p.health <= 0) continue;
            p.age += dt;
            if (p.voyage_id) continue;
            p.decision -= dt;
            p.gather += dt;
            const v = this.villages.find(v => v.id === p.village_id);
            const home = homes.get(p.home_id) || v;
            const enemies = war_targets.get(p.village_id);
            if (p.decision <= 0) {
                let a = this.random() * Math.PI * 2;
                if (home && Math.hypot(p.x - home.x, p.y - home.y) > 9 + Math.sqrt(home.houses.length)) a = Math.atan2(home.y - p.y, home.x - p.x);
                p.dx = Math.cos(a); p.dy = Math.sin(a); p.decision = 0.5 + this.random() * 3;
            }
            const order = p.role === 'soldier' ? army_orders.get(p.home_id || p.village_id) : null;
            let march_target = order?.target_id && p.age > 5
                ? Math.hypot(p.x - order.x, p.y - order.y) > 5 ? { x: order.x, y: order.y }
                    : { x: order.target_x, y: order.target_y } : null;
            if (enemies && p.role === 'soldier') {
                let foe = null, nearest = 100;
                for (const other of this.people) {
                    if (other.health <= 0 || !enemies.has(other.village_id)) continue;
                    const distance = (other.x - p.x) ** 2 + (other.y - p.y) ** 2;
                    if (distance < nearest) { foe = other; nearest = distance; }
                }
                if (foe) {
                    const angle = Math.atan2(foe.y - p.y, foe.x - p.x);
                    p.dx = Math.cos(angle); p.dy = Math.sin(angle);
                    march_target = foe;
                    if (nearest < 2.25) {
                        const weapon = 1 + (p.weapon_level || 0) * 0.28;
                        const armor = 1 + (foe.armor_level || 0) * 0.10;
                        foe.health -= dt * (p.race === 'orc' ? 18 : 14) * weapon / armor * (foe.race === 'orc' ? 0.75 : 1);
                    }
                }
            }
            if (march_target && Math.hypot(p.x - march_target.x, p.y - march_target.y) > 1) this.march(p, march_target, dt, 1.55);
            else this.move(p, dt, p.role === 'soldier' ? 1.55 : 1.3);
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
                if (p.role === 'soldier') food *= 0.35;
                else if (p.job === 'farmer') food *= 1.6;
                v.food += food;
                if (terrain === T.FOREST && p.role !== 'soldier') v.wood += (p.race === 'elf' ? 2 : 1) + (p.job === 'lumberjack' ? 1 : 0);
                const meal = p.role === 'soldier' ? 1.7 : 0.9;
                if (v.food < meal) p.health -= 6;
                else { v.food -= meal; p.health = Math.min(100, p.health + 1); }
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
        const home_populations = new Map(), kingdom_populations = new Map(), workers = new Map(), soldier_counts = new Map();
        for (const person of this.people) {
            kingdom_populations.set(person.village_id, (kingdom_populations.get(person.village_id) || 0) + 1);
            if (!person.voyage_id) home_populations.set(person.home_id, (home_populations.get(person.home_id) || 0) + 1);
            if (person.role === 'soldier') soldier_counts.set(person.village_id, (soldier_counts.get(person.village_id) || 0) + 1);
            else {
                const jobs = workers.get(person.village_id) || { farmer: 0, lumberjack: 0, miner: 0, smith: 0, builder: 0 };
                jobs[person.job] = (jobs[person.job] || 0) + 1;
                workers.set(person.village_id, jobs);
            }
        }
        for (const v of this.villages) {
            if (!v.alive) continue;
            v.age += dt; v.birth_timer += dt; v.expansion_timer += dt;
            v.ore ||= { copper: 0, tin: 0, iron: 0, coal: 0 };
            v.weapons ||= 0; v.armor_stock ||= 0; v.mine_timer = (v.mine_timer || 0) + dt; v.forge_timer = (v.forge_timer || 0) + dt;
            const before_technology = technology_level(v);
            const sites = this.settlements_of(v.id);
            const pop = kingdom_populations.get(v.id) || 0;
            const jobs = workers.get(v.id) || {};
            v.mine_level = jobs.miner > 0 ? 1 : 0;
            if (jobs.miner > 0 && v.mine_timer >= 8) {
                v.mine_timer = 0;
                let mined = 0;
                for (const site of sites) {
                    for (let dy = -12; dy <= 12 && mined < Math.min(3, jobs.miner); dy++) for (let dx = -12; dx <= 12 && mined < Math.min(3, jobs.miner); dx++) {
                        if (dx * dx + dy * dy > 144) continue;
                        const x = Math.floor(site.x) + dx, y = Math.floor(site.y) + dy;
                        if (!this.inside(x, y)) continue;
                        const ore = this.ores[this.index(x, y)];
                        if (ore) { const material = ['','copper','tin','iron','coal'][ore]; v.ore[material] += 4; this.ores[this.index(x, y)] = 0; mined++; this.revision++; }
                    }
                }
            }
            const research_cost = [null, { copper: 3 }, { copper: 5, tin: 2 }, { iron: 6, coal: 2 }, { iron: 8, coal: 4 }];
            const next_level = before_technology + 1;
            const next_threshold = TECH_AGES[next_level]?.threshold;
            const cost = research_cost[next_level];
            const research_rate = dt / this.year_length * (0.35 + Math.min(pop, 30) * 0.035 + Math.min(v.houses.length, 10) * 0.04);
            if (next_threshold && v.tech_points < next_threshold) v.tech_points = Math.min(next_threshold, v.tech_points + research_rate);
            const has_materials = cost && Object.entries(cost).every(([ore, amount]) => v.ore[ore] >= amount);
            const known_technology = !has_materials && next_threshold && v.tech_points >= next_threshold
                && this.villages.some(other => other.id !== v.id && technology_level(other) >= next_level);
            if (next_threshold && v.tech_points >= next_threshold && (has_materials || known_technology)) {
                if (has_materials) for (const [ore, amount] of Object.entries(cost)) v.ore[ore] -= amount;
                v.research_level = next_level;
            } else if (!next_threshold) v.tech_points = Math.min(1000, (v.tech_points || 0) + research_rate);
            const after_technology = technology_level(v);
            v.forge_level = after_technology > 0 && jobs.smith > 0 ? 1 : 0;
            if (after_technology > before_technology) this.log(`${v.name} enters the ${TECH_AGES[after_technology].name}. Their forges can now craft ${TECH_AGES[after_technology].weapon.toLowerCase()}s.`, 'village');
            if (after_technology > 0 && jobs.smith > 0 && v.forge_timer >= 10) {
                v.forge_timer = 0;
                const level = after_technology;
                const recipes = [null, { copper: 1 }, { copper: 1, tin: 1 }, { iron: 1, coal: 1 }, { iron: 2, coal: 1 }];
                const recipe = recipes[level];
                const reserve = research_cost[level + 1] || {};
                if (recipe && Object.entries(recipe).every(([ore, amount]) => v.ore[ore] - amount >= (reserve[ore] || 0)) && v.wood >= 1) {
                    for (const [ore, amount] of Object.entries(recipe)) v.ore[ore] -= amount;
                    v.wood--;
                    const unequipped = this.people.find(p => p.village_id === v.id && p.role === 'soldier' && (p.weapon_level || 0) < level)
                        || this.people.find(p => p.village_id === v.id && (p.weapon_level || 0) < level);
                    if (unequipped) unequipped.weapon_level = level;
                    else v.weapons++;
                    const unarmored = this.people.find(p => p.village_id === v.id && (p.armor_level || 0) < level);
                    if (level >= 2 && v.ore.iron > 0 && unarmored) { v.ore.iron--; unarmored.armor_level = level; }
                }
            }
            const house_cost = (v.race === 'dwarf' ? 4 : 5) - (jobs.builder > 0 ? 1 : 0);
            for (const site of sites) {
                if (site !== v) { site.age += dt; site.expansion_timer += dt; }
                const local_pop = home_populations.get(site.id) || 0;
                if (site.expansion_timer > 10 && v.wood >= house_cost && site.houses.length < Math.ceil(local_pop / 3) + 1) {
                    site.expansion_timer = 0;
                    if (this.add_house(site)) v.wood -= house_cost;
                }
            }
            const birth_delay = v.race === 'orc' ? 8 : 12;
            if (v.birth_timer > birth_delay && pop >= 2 && v.food > 8 && pop < sites.reduce((sum, site) => sum + site.houses.length * 5, 0) && this.people.length < this.max_people) {
                const site = sites[Math.floor(this.random() * sites.length)];
                const p = this.land_near(site.x, site.y, 4);
                if (p && this.add_person(p.x, p.y, v.id, v.race)) { this.people.at(-1).home_id = site.id; v.food -= 5; v.birth_timer = 0; }
            }
            v.training_timer = (v.training_timer || 0) + dt;
            if (!v.barracks && pop >= 8 && v.houses.length >= 2 && v.wood >= 12) {
                v.wood -= 12; v.barracks = 1;
                this.log(`${v.name} builds a barracks and begins training defenders.`, 'village');
            }
            const at_war = war_targets.has(v.id);
            const target_soldiers = at_war ? Math.max(2, Math.floor(pop / 3)) : Math.max(1, Math.floor(pop / 8));
            if (v.barracks && v.training_timer >= 8 && (soldier_counts.get(v.id) || 0) < target_soldiers && v.food >= 8 && v.wood >= 1) {
                const recruit = this.people.find(p => p.village_id === v.id && p.role !== 'soldier' && !p.voyage_id && p.age > 5 && (after_technology === 0 || p.weapon_level > 0 || v.weapons > 0));
                if (recruit) {
                    if (after_technology > 0 && !recruit.weapon_level && v.weapons > 0) { v.weapons--; recruit.weapon_level = after_technology; }
                    recruit.role = 'soldier'; v.food -= 3; v.wood--; v.training_timer = 0;
                    soldier_counts.set(v.id, (soldier_counts.get(v.id) || 0) + 1);
                    this.log(`${v.name} trains a soldier at its barracks.`, 'village');
                }
            }
        }
        if (this.tick % 240 === 0) this.schedule_trades();
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
        const kingdoms = this.villages.filter(v => v.alive).length;
        return { population: this.people.length, soldiers: this.people.filter(p => p.role === 'soldier').length, wildlife: this.animals.length, villages: kingdoms, towns: kingdoms + this.colonies.length, trees, land: Math.round(land / this.tiles.length * 100) };
    }
    serialize() {
        return { format: 'genesis-grove', version: 1, name: this.name, seed: this.seed, rng: this.rng, time: this.time, tick: this.tick, next_id: this.next_id, scenario: this.scenario, year_length: this.year_length, laws: { ...this.laws }, milestone: this.milestone, tiles: Array.from(this.tiles), ores: Array.from(this.ores), fire: Array.from(this.fire), fertility: Array.from(this.fertility), people: structuredClone(this.people), animals: structuredClone(this.animals), villages: structuredClone(this.villages), colonies: structuredClone(this.colonies), voyages: structuredClone(this.voyages), trades: structuredClone(this.trades), relations: structuredClone(this.relations), events: structuredClone(this.events) };
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
        if (data.ores !== undefined && (!array(data.ores, size) || data.ores.length !== size || !data.ores.every(n => integer(n, 0, 4)))) invalid();
        if (!array(data.fire, size) || data.fire.length !== size || !data.fire.every(n => num(n, -0.25, 60))) invalid();
        if (!array(data.fertility, size) || data.fertility.length !== size || !data.fertility.every(n => num(n, 0, 1))) invalid();
        if (!num(data.time) || !integer(data.tick, 0, 1e10) || !integer(data.rng, 1, 4294967295) || !integer(data.next_id, 1, 1e9)) invalid();
        if (!array(data.villages, MAX_VILLAGES) || !array(data.people, MAX_PEOPLE) || !array(data.animals, 350) || !array(data.events, 40) || (data.relations !== undefined && !array(data.relations, 2000)) || (data.colonies !== undefined && !array(data.colonies, MAX_COLONIES)) || (data.voyages !== undefined && !array(data.voyages, MAX_VOYAGES)) || (data.trades !== undefined && !array(data.trades, MAX_TRADES))) invalid();
        if (data.scenario !== undefined && !['sandbox', 'hundred'].includes(data.scenario)) invalid();
        if (data.year_length !== undefined && ![2, 20].includes(data.year_length)) invalid();
        if (data.laws !== undefined && (!data.laws || typeof data.laws.rebellions !== 'boolean' || typeof data.laws.diplomacy !== 'boolean' || (data.laws.expansion !== undefined && typeof data.laws.expansion !== 'boolean'))) invalid();
        if (data.milestone !== undefined && !integer(data.milestone, 0, 4)) invalid();
        const ids = new Set();
        const id = v => { if (!integer(v, 1, data.next_id - 1) || ids.has(v)) invalid(); ids.add(v); };
        for (const v of data.villages) {
            if (!point(v) || typeof v.name !== 'string' || v.name.length > 40 || !/^#[0-9a-f]{6}$/i.test(v.color) || typeof v.alive !== 'boolean' || !array(v.houses, 220) || !v.houses.every(point) || (v.race !== undefined && !RACES[v.race])) invalid();
            if (!['food', 'wood', 'age', 'birth_timer', 'expansion_timer'].every(k => num(v[k]))) invalid();
            if ((v.deaths !== undefined && !integer(v.deaths, 0, 1e9)) || (v.founded_year !== undefined && !integer(v.founded_year, 1, 1e9)) || (v.siege !== undefined && !num(v.siege, 0, 1000)) || (v.tech_points !== undefined && !num(v.tech_points, 0, 1000)) || (v.research_level !== undefined && !integer(v.research_level, 0, TECH_AGES.length - 1))) invalid();
            if (v.ore !== undefined && (!v.ore || !['copper','tin','iron','coal'].every(k => num(v.ore[k], 0, 1e6)))) invalid();
            if (v.weapons !== undefined && !integer(v.weapons, 0, 1e6)) invalid();
            if (v.training_timer !== undefined && !num(v.training_timer, 0, 1e6)) invalid();
            if (['barracks','mine_level','forge_level'].some(k => v[k] !== undefined && !integer(v[k], 0, 1))) invalid();
            id(v.id);
        }
        const villages = new Set(data.villages.map(v => v.id));
        const colonies = new Map();
        for (const c of data.colonies || []) {
            if (!point(c) || !villages.has(c.kingdom_id) || typeof c.name !== 'string' || c.name.length > 40 || !array(c.houses, 220) || !c.houses.every(point) || !['age', 'birth_timer', 'expansion_timer', 'siege'].every(k => num(c[k]))) invalid();
            id(c.id); colonies.set(c.id, c.kingdom_id);
        }
        const voyages = new Map();
        for (const v of data.voyages || []) {
            if (!point(v) || !point({ x: v.target_x, y: v.target_y }) || !villages.has(v.kingdom_id) || !num(v.progress, 0, 1) || !num(v.duration, 0.001, 500) || !['ship', 'caravan'].includes(v.kind) || !array(v.crew_ids, 3) || v.crew_ids.length !== 3 || new Set(v.crew_ids).size !== 3) invalid();
            id(v.id); voyages.set(v.id, v);
        }
        for (const trade of data.trades || []) {
            if (!villages.has(trade.from_id) || !villages.has(trade.to_id) || trade.from_id === trade.to_id || !['food','wood','copper','tin','iron','coal'].includes(trade.good) || !integer(trade.amount, 1, 100) || !num(trade.progress, 0, 1) || !num(trade.duration, 0.001, 500) || !['ship','caravan'].includes(trade.kind)) invalid();
            id(trade.id);
        }
        for (const u of [...data.people, ...data.animals]) {
            if (!point(u) || !num(u.health, -1000, 100) || !num(u.age) || !num(u.dx, -1, 1) || !num(u.dy, -1, 1) || !num(u.decision, -0.25, 10)) invalid();
            id(u.id);
        }
        for (const p of data.people) {
            if (!villages.has(p.village_id) || !num(p.gather, 0, 10) || (p.race !== undefined && !RACES[p.race]) || (p.infection !== undefined && !num(p.infection, 0, 1))) invalid();
            if ((p.weapon_level !== undefined && !integer(p.weapon_level, 0, TECH_AGES.length - 1)) || (p.armor_level !== undefined && !integer(p.armor_level, 0, TECH_AGES.length - 1))) invalid();
            if ((p.job !== undefined && !JOBS.includes(p.job)) || (p.role !== undefined && !['civilian','soldier'].includes(p.role))) invalid();
            if (p.home_id !== undefined && p.home_id !== p.village_id && colonies.get(p.home_id) !== p.village_id) invalid();
            if (p.voyage_id !== undefined && p.voyage_id !== null && (!voyages.has(p.voyage_id) || !voyages.get(p.voyage_id).crew_ids.includes(p.id))) invalid();
        }
        for (const voyage of voyages.values()) if (!voyage.crew_ids.every(crew_id => data.people.some(p => p.id === crew_id && p.village_id === voyage.kingdom_id && p.voyage_id === voyage.id))) invalid();
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
        w.colonies = structuredClone(data.colonies || []);
        w.voyages = structuredClone(data.voyages || []);
        w.trades = structuredClone(data.trades || []);
        w.scenario = data.scenario || 'sandbox';
        w.year_length = data.year_length || 20;
        w.laws = { rebellions: data.laws?.rebellions || false, diplomacy: data.laws?.diplomacy || false, expansion: data.laws?.expansion ?? data.scenario === 'hundred' };
        w.milestone = data.milestone || 0;
        const legacy_jobs = new Map();
        for (const p of w.people) { p.race ||= 'human'; p.infection ||= 0; p.home_id ||= p.village_id; p.voyage_id ||= null; p.weapon_level ||= 0; p.armor_level ||= 0; p.job ||= JOBS[(legacy_jobs.get(p.village_id) || 0) % JOBS.length]; p.role ||= 'civilian'; legacy_jobs.set(p.village_id, (legacy_jobs.get(p.village_id) || 0) + 1); }
        for (const a of w.animals) a.infection ||= 0;
        for (const v of w.villages) { v.race ||= 'human'; v.deaths ||= 0; v.founded_year ||= 1; v.siege ||= 0; v.tech_points ??= Math.min(1000, v.age / w.year_length); v.research_level ??= (() => { let level = 0; for (let i = 1; i < TECH_AGES.length; i++) if (v.tech_points >= TECH_AGES[i].threshold) level = i; return level; })(); v.ore ||= { copper: 0, tin: 0, iron: 0, coal: 0 }; v.weapons ||= 0; v.armor_stock ||= 0; v.mine_timer ||= 0; v.forge_timer ||= 0; v.training_timer ||= 0; v.barracks ||= 0; v.mine_level ||= 0; v.forge_level ||= 0; }
        w.tiles = Uint8Array.from(data.tiles); w.ores = data.ores ? Uint8Array.from(data.ores) : new Uint8Array(size); w.fire = Float32Array.from(data.fire); w.fertility = Float32Array.from(data.fertility);
        if (!data.ores) for (let i = 0; i < size; i++) {
            if (w.tiles[i] < T.HILL || noise((i % WIDTH) / 3, Math.floor(i / WIDTH) / 3, hash_string(w.seed) + 33) < 0.74) continue;
            w.ores[i] = 1 + Math.floor(noise((i % WIDTH) / 7, Math.floor(i / WIDTH) / 7, hash_string(w.seed) + 977) * 4);
        }
        return w;
    }
}
