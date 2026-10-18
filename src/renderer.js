import { WIDTH, HEIGHT, T, TECH_AGES, technology_level } from './simulation.js';
export const PALETTE = ['#174655', '#28717a', '#c0b981', '#83a85d', '#547b46', '#8d9068', '#8d9b8d', '#bf6336', '#696a56'];
const CELL = 6;
function tile_hash(x, y) { return ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0) / 4294967295; }
export class Renderer {
    constructor(canvas, minimap) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.minimap = minimap;
        this.mini = minimap.getContext('2d');
        this.terrain = document.createElement('canvas');
        this.terrain.width = WIDTH * CELL; this.terrain.height = HEIGHT * CELL;
        this.tc = this.terrain.getContext('2d', { alpha: false });
        this.territory = document.createElement('canvas');
        this.territory.width = WIDTH; this.territory.height = HEIGHT;
        this.territory_ctx = this.territory.getContext('2d');
        this.territory_last = -Infinity;
        this.zoom = 1; this.pan_x = 0; this.pan_y = 0;
        this.borders = true; this.pointer = null; this.brush = 4; this.tool = 'grass';
        this.last_revision = -1; this.last_cache = 0;
        this.resize();
        new ResizeObserver(() => this.resize()).observe(canvas);
    }
    resize() {
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
        this.base = Math.min(this.width / (WIDTH * CELL), this.height / (HEIGHT * CELL)) * 0.93;
    }
    get scale() { return this.base * this.zoom; }
    get origin() { return { x: (this.width - WIDTH * CELL * this.scale) / 2 + this.pan_x, y: (this.height - HEIGHT * CELL * this.scale) / 2 + this.pan_y }; }
    world_point(x, y) {
        const o = this.origin;
        return { x: (x - o.x) / this.scale / CELL, y: (y - o.y) / this.scale / CELL };
    }
    zoom_at(multiplier, x = this.width / 2, y = this.height / 2) {
        const before = this.world_point(x, y);
        this.zoom = Math.max(0.65, Math.min(7, this.zoom * multiplier));
        const after = this.world_point(x, y);
        this.pan_x += (after.x - before.x) * CELL * this.scale;
        this.pan_y += (after.y - before.y) * CELL * this.scale;
    }
    fit() { this.zoom = 1; this.pan_x = 0; this.pan_y = 0; }
    focus(x, y) {
        this.zoom = 2.4;
        this.pan_x = (WIDTH / 2 - x) * CELL * this.scale;
        this.pan_y = (HEIGHT / 2 - y) * CELL * this.scale;
    }
    cache(world) {
        const c = this.tc;
        const mini_image = this.mini.createImageData(WIDTH, HEIGHT);
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const t = world.tiles[y * WIDTH + x], h = tile_hash(x, y), px = x * CELL, py = y * CELL;
            c.fillStyle = PALETTE[t]; c.fillRect(px, py, CELL, CELL);
            c.fillStyle = h > 0.5 ? '#ffffff07' : '#00000008'; c.fillRect(px, py, CELL, CELL);
            if (t === T.GRASS) {
                if (h > 0.72) { c.fillStyle = '#a9c078'; c.fillRect(px + 1, py + 2, 1, 1); c.fillRect(px + 3, py + 4, 1, 1); }
                if (h < 0.08) { c.fillStyle = '#c9cb93'; c.fillRect(px + 2, py + 3, 1, 1); }
            } else if (t === T.FOREST) {
                c.fillStyle = '#344e35'; c.fillRect(px + 2, py + 3, 3, 3);
                c.fillStyle = h > 0.5 ? '#375b38' : '#3b663c'; c.fillRect(px + 1, py + 1, 4, 3);
                c.fillStyle = '#6d914f'; c.fillRect(px + 1, py, 3, 2);
                c.fillStyle = '#8ca35c'; c.fillRect(px + 2, py, 1, 1);
            } else if (t === T.MOUNTAIN) {
                c.fillStyle = '#657773'; c.fillRect(px, py + 4, 6, 2);
                c.fillStyle = '#aab8a5'; c.fillRect(px + 2, py + 1, 3, 4);
                c.fillStyle = '#d1d7c0'; c.fillRect(px + 2, py, 2, 2);
                c.fillStyle = '#78908a'; c.fillRect(px + 4, py + 3, 2, 3);
            } else if (t === T.HILL) {
                c.fillStyle = '#a1a077'; c.fillRect(px + 1, py + 1, 3, 2);
                c.fillStyle = '#747e5f'; c.fillRect(px + 3, py + 3, 3, 2);
            } else if (t === T.SAND && h > 0.7) {
                c.fillStyle = '#e4d5a0'; c.fillRect(px + 1, py + 2, 2, 1);
            } else if (t === T.SHALLOW) {
                c.fillStyle = '#5d999033'; c.fillRect(px + 1, py + 2, 3, 1);
                if (world.tile(x + 1, y) >= T.SAND || world.tile(x, y + 1) >= T.SAND) { c.fillStyle = '#8bb8a5aa'; c.fillRect(px + 1, py + 4, 5, 1); }
            } else if (t === T.OCEAN && h > 0.92) {
                c.fillStyle = '#43808a45'; c.fillRect(px, py + 2, 3, 1);
            } else if (t === T.LAVA) {
                c.fillStyle = '#ee9c4a'; c.fillRect(px + 1, py + 2, 3, 2);
                c.fillStyle = '#f4c66c'; c.fillRect(px + 2, py + 2, 1, 1);
            }
            const ore = world.ores?.[y * WIDTH + x] || 0;
            if (ore && (h > 0.38 || t >= T.MOUNTAIN)) {
                c.fillStyle = ['', '#d77c50', '#ddc08a', '#c9d3d4', '#474a47'][ore];
                c.fillRect(px + (h > 0.6 ? 1 : 3), py + (h > 0.6 ? 3 : 1), 2, 2);
            }
            const hex = PALETTE[t].slice(1), j = (y * WIDTH + x) * 4;
            mini_image.data[j] = parseInt(hex.slice(0, 2), 16); mini_image.data[j + 1] = parseInt(hex.slice(2, 4), 16); mini_image.data[j + 2] = parseInt(hex.slice(4, 6), 16); mini_image.data[j + 3] = 255;
        }
        this.mini.putImageData(mini_image, 0, 0);
        for (const v of world.villages.filter(v => v.alive)) { this.mini.fillStyle = v.color; this.mini.fillRect(v.x - 1, v.y - 1, 3, 3); }
        const kingdoms = new Map(world.villages.map(v => [v.id, v]));
        for (const colony of world.colonies) {
            this.mini.fillStyle = kingdoms.get(colony.kingdom_id)?.color || '#d7dbc4';
            this.mini.fillRect(colony.x, colony.y, 2, 2);
        }
        this.last_revision = world.revision;
    }
    cache_territory(world) {
        const kingdoms = new Map(world.villages.map(v => [v.id, v]));
        const living = [...world.villages.filter(v => v.alive), ...world.colonies];
        const owners = new Int32Array(WIDTH * HEIGHT).fill(-1);
        const image = this.territory_ctx.createImageData(WIDTH, HEIGHT);
        const colors = new Map([...kingdoms].map(([id, kingdom]) => [id, [1, 3, 5].map(i => parseInt(kingdom.color.slice(i, i + 2), 16))]));
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x;
            if (world.tiles[i] < T.SAND || world.tiles[i] > T.HILL) continue;
            let owner = -1, distance = Infinity;
            for (let k = 0; k < living.length; k++) {
                const dx = living[k].x - x, dy = living[k].y - y;
                const candidate = dx * dx + dy * dy;
                if (candidate < distance) { distance = candidate; owner = k; }
            }
            owners[i] = owner < 0 ? -1 : living[owner].kingdom_id || living[owner].id;
        }
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x, owner = owners[i];
            if (owner < 0) continue;
            const edge = (x > 0 && owners[i - 1] !== owner) || (x < WIDTH - 1 && owners[i + 1] !== owner)
                || (y > 0 && owners[i - WIDTH] !== owner) || (y < HEIGHT - 1 && owners[i + WIDTH] !== owner);
            const j = i * 4;
            const color = colors.get(owner) || [215, 219, 196];
            image.data[j] = color[0]; image.data[j + 1] = color[1];
            image.data[j + 2] = color[2]; image.data[j + 3] = edge ? 225 : 82;
        }
        this.territory_ctx.putImageData(image, 0, 0);
    }
    render(world, now) {
        if (this.last_revision !== world.revision && now - this.last_cache > 220) { this.cache(world); this.last_cache = now; }
        const c = this.ctx, o = this.origin, s = this.scale;
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.fillStyle = '#143e4b'; c.fillRect(0, 0, this.width, this.height);
        c.save(); c.translate(o.x, o.y); c.scale(s, s); c.imageSmoothingEnabled = false;
        c.drawImage(this.terrain, 0, 0);
        if (this.borders) {
            if (now - this.territory_last > 1500) { this.cache_territory(world); this.territory_last = now; }
            c.drawImage(this.territory, 0, 0, WIDTH * CELL, HEIGHT * CELL);
        }
        const kingdoms = new Map(world.villages.map(v => [v.id, v]));
        // Slow glints make the sea feel alive without moving the terrain itself.
        for (let i = 0; i < 85; i++) {
            const x = (i * 73 + 19) % WIDTH, y = (i * 31 + 9) % HEIGHT;
            if (world.tile(x, y) > T.SHALLOW) continue;
            c.globalAlpha = Math.max(0, Math.sin(now / 1700 + i * 3)) * 0.22;
            c.fillStyle = '#86c3c6'; c.fillRect(x * CELL, y * CELL + 2, 3 + Math.sin(now / 1000 + i) * 2, 1);
        }
        c.globalAlpha = 1;
        for (const v of world.villages) {
            if (!v.alive) continue;
            // Trails lead to homes, then little farms grow around the settlement.
            for (const h of v.houses) {
                c.strokeStyle = '#c1b17e9c'; c.lineWidth = 2;
                c.beginPath(); c.moveTo(v.x * CELL, v.y * CELL); c.lineTo(h.x * CELL, v.y * CELL); c.lineTo(h.x * CELL, h.y * CELL); c.stroke();
            }
            for (let j = 0; j < Math.min(v.houses.length, 5); j++) {
                const h = v.houses[j], x = h.x * CELL + 8, y = h.y * CELL + 5;
                if (world.walkable(h.x + 2, h.y + 1)) {
                    c.fillStyle = '#7d7844'; c.fillRect(x, y, 8, 7);
                    c.fillStyle = '#c2ad60'; for (let k = 1; k < 8; k += 2) c.fillRect(x + k, y + 1, 1, 5);
                }
            }
            for (const h of v.houses) this.house(c, h.x * CELL, h.y * CELL, v.color, false, technology_level(v));
            this.house(c, v.x * CELL, v.y * CELL, v.color, true, technology_level(v));
            this.industry(c, v.x * CELL, v.y * CELL, v);
        }
        for (const colony of world.colonies) {
            const kingdom = kingdoms.get(colony.kingdom_id);
            if (!kingdom?.alive) continue;
            for (const house of colony.houses) this.house(c, house.x * CELL, house.y * CELL, kingdom.color, false, technology_level(kingdom));
            this.house(c, colony.x * CELL, colony.y * CELL, kingdom.color, true, technology_level(kingdom));
        }
        for (const voyage of world.voyages) {
            const x = (voyage.x + (voyage.target_x - voyage.x) * voyage.progress) * CELL;
            const y = (voyage.y + (voyage.target_y - voyage.y) * voyage.progress) * CELL;
            c.fillStyle = '#352d26'; c.fillRect(x - 6, y + 2, 13, 3);
            c.fillStyle = voyage.kind === 'ship' ? '#e8e3c9' : '#bca87b';
            c.fillRect(x - 1, y - 8, 2, 10); c.fillRect(x + 1, y - 7, 5, 6);
            c.fillStyle = kingdoms.get(voyage.kingdom_id)?.color || '#e8e3c9'; c.fillRect(x - 5, y, 11, 2);
        }
        for (const trade of world.trades || []) {
            const sender = kingdoms.get(trade.from_id), recipient = kingdoms.get(trade.to_id);
            if (!sender || !recipient) continue;
            const x = (sender.x + (recipient.x - sender.x) * trade.progress) * CELL;
            const y = (sender.y + (recipient.y - sender.y) * trade.progress) * CELL;
            c.fillStyle = trade.kind === 'ship' ? '#735b45' : '#8e724e'; c.fillRect(x - 6, y, 12, 4);
            c.fillStyle = trade.good === 'food' ? '#c6bb6d' : trade.good === 'wood' ? '#7e9d59' : '#a9b8b8'; c.fillRect(x - 3, y - 4, 6, 4);
            if (trade.kind === 'ship') { c.fillStyle = '#e9dfb8'; c.fillRect(x, y - 10, 1, 8); c.fillRect(x + 1, y - 9, 5, 5); }
            else { c.fillStyle = '#3f3b32'; c.fillRect(x - 4, y + 3, 2, 2); c.fillRect(x + 3, y + 3, 2, 2); }
        }
        for (const animal of world.animals) this.animal(c, animal);
        for (const p of world.people) {
            if (p.voyage_id) continue;
            this.person(c, p, kingdoms.get(p.village_id), now);
        }
        for (let i = 0; i < world.fire.length; i++) if (world.fire[i] > 0) {
            const x = (i % WIDTH) * CELL, y = Math.floor(i / WIDTH) * CELL;
            const flicker = Math.sin(now / 80 + i) > 0 ? 1 : 0;
            c.fillStyle = '#c54b29'; c.fillRect(x, y, 5, 5);
            c.fillStyle = '#ed982f'; c.fillRect(x + 1, y - flicker * 2, 3, 5);
            c.fillStyle = '#f9da77'; c.fillRect(x + 2, y, 1, 3);
            if (i % 3 === 0) { c.fillStyle = '#636b6255'; c.fillRect(x + 2, y - 6 - (now / 60 + i) % 10, 4, 4); }
        }
        for (const e of world.effects) this.effect(c, e, now);
        // Drifting, translucent cloud shadows; all artwork is generated in code.
        for (let i = 0; i < 5; i++) {
            const x = ((now / 1700 + i * 241) % (WIDTH * CELL + 180)) - 100;
            const y = 90 + (i * 173) % (HEIGHT * CELL - 160);
            c.fillStyle = '#041e2b0b'; c.fillRect(x + 20, y + 30, 72, 15); c.fillRect(x + 35, y + 20, 48, 35);
            c.fillStyle = '#d6eee510'; c.fillRect(x, y, 55, 10); c.fillRect(x + 13, y - 8, 28, 25);
        }
        if (this.pointer) {
            const p = this.world_point(this.pointer.x, this.pointer.y);
            if (world.inside(p.x, p.y)) {
                c.strokeStyle = '#f0f5d6dc'; c.fillStyle = '#edfad40e'; c.lineWidth = 1.2 / s;
                c.beginPath(); c.arc((Math.floor(p.x) + 0.5) * CELL, (Math.floor(p.y) + 0.5) * CELL, (this.tool === 'inspect' ? 0.7 : this.brush) * CELL, 0, Math.PI * 2); c.fill(); c.stroke();
                c.fillStyle = '#eff7d8'; c.fillRect(p.x * CELL - 1, p.y * CELL - 1, 2, 2);
            }
        }
        c.restore();
        const show_labels = world.villages.length < 20 || this.zoom > 1.7;
        if (this.borders && show_labels) for (const v of world.villages.filter(v => v.alive)) {
            const x = o.x + v.x * CELL * s, y = o.y + (v.y * CELL - 38) * s;
            if (x < -100 || x > this.width + 100 || y < -20 || y > this.height + 20) continue;
            c.font = '600 9px -apple-system, Segoe UI, sans-serif';
            const w = c.measureText(v.name).width + 19;
            c.fillStyle = '#152d24df'; c.beginPath(); c.roundRect(x - w / 2, y - 9, w, 19, 4); c.fill();
            c.fillStyle = v.color; c.textAlign = 'center'; c.fillText(v.name, x, y + 3);
        }
        if (this.borders && this.zoom > 2.4) for (const colony of world.colonies) {
            const x = o.x + colony.x * CELL * s, y = o.y + (colony.y * CELL - 26) * s;
            if (x < -90 || x > this.width + 90 || y < -20 || y > this.height + 20) continue;
            c.font = '500 8px -apple-system, Segoe UI, sans-serif';
            c.fillStyle = '#18291fdb'; c.fillRect(x - 38, y - 9, 76, 15);
            c.fillStyle = kingdoms.get(colony.kingdom_id)?.color || '#e8e3c9'; c.textAlign = 'center';
            c.fillText(colony.name.slice(0, 14), x, y + 2);
        }
    }
    animal(c, animal) {
        const x = Math.round(animal.x * CELL), y = Math.round(animal.y * CELL);
        const face = animal.dx < 0 ? -1 : 1;
        c.fillStyle = '#10262277'; c.fillRect(x - 5, y + 4, 10, 2);
        if (animal.species === 'bear') {
            c.fillStyle = '#65432f'; c.fillRect(x - 6, y - 4, 11, 8); c.fillRect(x + face * 5 - 2, y - 3, 4, 5);
            c.fillStyle = '#9c7048'; c.fillRect(x - 5, y - 6, 3, 3); c.fillRect(x + 2, y - 6, 3, 3);
            c.fillStyle = '#30251e'; c.fillRect(x + face * 7 - 1, y - 1, 2, 1);
        } else if (animal.species === 'wolf') {
            c.fillStyle = '#7e8990'; c.fillRect(x - 5, y - 2, 9, 5); c.fillRect(x + face * 5 - 2, y - 5, 4, 5);
            c.fillStyle = '#c2c7c2'; c.fillRect(x + face * 5 - 2, y - 8, 2, 3); c.fillRect(x + face * 7 - 2, y - 7, 2, 3);
            c.fillStyle = '#52585c'; c.fillRect(x - face * 6, y - 3, 3, 2);
        } else if (animal.species === 'deer') {
            c.fillStyle = '#a8794b'; c.fillRect(x - 4, y - 3, 8, 5); c.fillRect(x + face * 4 - 1, y - 7, 3, 5);
            c.fillStyle = '#d6b37f'; c.fillRect(x + face * 5 - 1, y - 11, 1, 5); c.fillRect(x + face * 7 - 1, y - 10, 1, 3);
            c.fillStyle = '#e7c99b'; c.fillRect(x - 2, y + 1, 4, 1);
        } else if (animal.species === 'rabbit') {
            c.fillStyle = '#f3e6d6'; c.fillRect(x - 3, y - 2, 6, 5); c.fillRect(x + face * 3 - 1, y - 4, 3, 4);
            c.fillStyle = '#d7a7aa'; c.fillRect(x + face * 2 - 1, y - 9, 1, 6); c.fillRect(x + face * 4 - 1, y - 8, 1, 5);
            c.fillStyle = '#ffffff'; c.fillRect(x - face * 4, y, 2, 2);
        } else if (animal.species === 'chicken') {
            c.fillStyle = '#f2df9b'; c.fillRect(x - 3, y - 2, 6, 5); c.fillRect(x + face * 3 - 1, y - 4, 3, 3);
            c.fillStyle = '#d75e45'; c.fillRect(x + face * 2 - 1, y - 7, 2, 3);
            c.fillStyle = '#edaa4e'; c.fillRect(x + face * 5 - 1, y - 2, 3, 1);
        } else {
            c.fillStyle = '#e8e9df'; c.fillRect(x - 5, y - 3, 9, 6); c.fillRect(x - 4, y - 5, 3, 3); c.fillRect(x, y - 5, 3, 3);
            c.fillStyle = '#454a42'; c.fillRect(x + face * 5 - 2, y - 4, 4, 5);
        }
        c.fillStyle = '#2e302b'; c.fillRect(x + face * 6 - 1, y - 4, 1, 1);
        c.fillStyle = '#473b2e'; c.fillRect(x - 3, y + 2, 1, 3); c.fillRect(x + 2, y + 2, 1, 3);
    }
    person(c, person, kingdom, now) {
        const x = Math.round(person.x * CELL), y = Math.round(person.y * CELL);
        const level = person.weapon_level || 0, armor = person.armor_level || 0, face = person.dx < 0 ? -1 : 1;
        const skin = person.race === 'orc' ? '#8fbc6c' : person.race === 'dwarf' ? '#d69b75' : '#f0c9a0';
        c.fillStyle = '#172a2266'; c.fillRect(x - 3, y + 3, 7, 2);
        c.fillStyle = '#3f443c'; c.fillRect(x - 2, y + 1, 2, 4); c.fillRect(x + 1, y + 1, 2, 4);
        c.fillStyle = kingdom?.color || '#e4dfb2'; c.fillRect(x - 3, y - 4, 6, 6);
        c.fillStyle = '#213129'; c.fillRect(x - 3, y, 6, 1);
        c.fillStyle = skin; c.fillRect(x - 2, y - 8, 4, 4);
        c.fillStyle = person.race === 'elf' ? '#e5d9a2' : person.race === 'orc' ? '#344330' : '#493d32';
        c.fillRect(x - 2, y - 9, 4, 2);
        if (person.role === 'soldier') { c.fillStyle = TECH_AGES[Math.max(level, 1)].color; c.fillRect(x - 3, y - 10, 6, 2); c.fillRect(x - 3, y - 4, 1, 4); c.fillRect(x + 2, y - 4, 1, 4); }
        if (person.race === 'elf') { c.fillStyle = skin; c.fillRect(x - 4, y - 7, 2, 1); c.fillRect(x + 2, y - 7, 2, 1); }
        if (person.race === 'dwarf') { c.fillStyle = '#a5683f'; c.fillRect(x - 2, y - 5, 4, 3); }
        if (person.race === 'orc') { c.fillStyle = '#e9dfb8'; c.fillRect(x - 3, y - 5, 1, 2); c.fillRect(x + 2, y - 5, 1, 2); }
        if (armor > 0) { c.fillStyle = TECH_AGES[armor].color; c.fillRect(x - 4, y - 3, 2, 4); c.fillRect(x + 2, y - 3, 2, 4); }
        c.fillStyle = '#e3d4bd'; c.fillRect(x - 1, y - 2, 2, 2);
        const metal = TECH_AGES[level].color;
        const sway = Math.round(Math.sin(now / 250 + person.id) * 1);
        c.fillStyle = level === 0 ? '#705845' : '#554735'; c.fillRect(x + face * 4 - 1, y - 8 + sway, 2, 9);
        c.fillStyle = metal;
        if (level === 0) c.fillRect(x + face * 4 - 2, y - 9 + sway, 4, 3);
        else { c.fillRect(x + face * 4 - 1, y - 12 + sway, 2, 6); c.fillRect(x + face * 4 - 3, y - 6 + sway, 6, 1); }
        if (level >= 2 || person.role === 'soldier') { c.fillStyle = metal; c.fillRect(x - face * 4 - 2, y - 3, 3, 5); }
    }
    house(c, x, y, color, town, level = 0) {
        const w = town ? 13 : 8, h = town ? 10 : 7;
        c.fillStyle = '#29392766'; c.fillRect(x - w / 2 + 2, y + 2, w + 2, 3);
        c.fillStyle = level >= 3 ? '#b9c0bd' : level >= 2 ? '#ddc99d' : '#e3cd9c'; c.fillRect(x - w / 2, y - h, w, h);
        c.fillStyle = '#b0a075'; c.fillRect(x + w / 2 - 3, y - h, 3, h);
        c.fillStyle = level >= 4 ? '#6198a9' : level >= 3 ? '#596b77' : level >= 2 ? '#a47444' : '#855b3d'; c.fillRect(x - w / 2 - 1, y - h - 3, w + 2, 4);
        c.fillStyle = color; c.fillRect(x - w / 2 + 1, y - h - 5, w - 2, 3);
        c.fillStyle = '#574d38'; c.fillRect(x - 1, y - 4, 2, 4);
        c.fillStyle = '#f7dd8d'; c.fillRect(x - w / 2 + 1, y - 5, 1, 2);
        if (town) { c.fillStyle = '#665b3e'; c.fillRect(x + 3, y - 20, 1, 10); c.fillStyle = color; c.fillRect(x + 4, y - 20, 5, 3); }
        if (town && level >= 2) { c.fillStyle = level >= 3 ? '#aeb6b1' : '#bc9968'; c.fillRect(x - 10, y - 15, 4, 15); c.fillRect(x + 8, y - 13, 4, 13); }
    }
    industry(c, x, y, kingdom) {
        if (kingdom.mine_level) {
            c.fillStyle = '#463d32'; c.fillRect(x - 19, y - 7, 11, 7);
            c.fillStyle = '#7c6750'; c.fillRect(x - 20, y - 10, 13, 4);
            c.fillStyle = '#b4a080'; c.fillRect(x - 17, y - 6, 2, 6); c.fillRect(x - 12, y - 6, 2, 6);
            c.fillStyle = '#d7b76b'; c.fillRect(x - 15, y - 4, 3, 2);
        }
        if (kingdom.forge_level) {
            c.fillStyle = '#544538'; c.fillRect(x + 9, y - 8, 12, 8);
            c.fillStyle = '#98634a'; c.fillRect(x + 8, y - 11, 14, 4);
            c.fillStyle = '#d77c50'; c.fillRect(x + 13, y - 7, 4, 4);
            c.fillStyle = '#edcf7c'; c.fillRect(x + 14, y - 6, 2, 2);
            c.fillStyle = '#78675a'; c.fillRect(x + 18, y - 15, 3, 6);
        }
        if (kingdom.barracks) {
            c.fillStyle = '#5d5448'; c.fillRect(x + 25, y - 9, 12, 9);
            c.fillStyle = '#ae9870'; c.fillRect(x + 24, y - 12, 14, 4);
            c.fillStyle = kingdom.color; c.fillRect(x + 29, y - 15, 6, 3);
            c.fillStyle = '#d7c48f'; c.fillRect(x + 30, y - 5, 3, 5);
        }
    }
    effect(c, e, now) {
        const x = e.x * CELL, y = e.y * CELL, r = e.radius * CELL;
        c.save(); c.globalAlpha = e.life;
        if (e.type === 'lightning') {
            c.strokeStyle = '#f7f8c0'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(x + 20, y - 140); c.lineTo(x - 6, y - 70); c.lineTo(x + 9, y - 72); c.lineTo(x, y); c.stroke();
            c.fillStyle = '#ffffc433'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        } else if (e.type === 'meteor') {
            const progress = 1 - e.life;
            c.strokeStyle = '#fdba69'; c.lineWidth = 4;
            c.beginPath(); c.arc(x, y, r * (0.5 + progress * 2), 0, Math.PI * 2); c.stroke();
            c.fillStyle = '#ffe6a866'; c.beginPath(); c.arc(x, y, r * (1 - progress), 0, Math.PI * 2); c.fill();
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillStyle = '#ffd68d'; c.fillRect(x + Math.cos(a) * r * progress * 2, y + Math.sin(a) * r * progress * 2, 3, 3); }
        } else if (e.type === 'rain') {
            c.strokeStyle = '#9dd9e4'; c.lineWidth = 1;
            for (let i = 0; i < 23; i++) { const dx = Math.sin(i * 17) * r, dy = ((i * 13 + now / 25) % (r * 2)) - r; c.beginPath(); c.moveTo(x + dx, y + dy - 5); c.lineTo(x + dx - 2, y + dy + 2); c.stroke(); }
        } else {
            c.strokeStyle = '#e1ed95'; c.lineWidth = 1.5;
            c.beginPath(); c.arc(x, y, r * (1.2 - e.life * 0.4), 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + now / 1500; c.fillStyle = '#efffc6'; c.fillRect(x + Math.cos(a) * r / 2, y + Math.sin(a) * r / 2 - (1 - e.life) * 15, 2, 2); }
        }
        c.restore();
    }
}
