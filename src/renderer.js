import { WIDTH, HEIGHT, T } from './simulation.js';
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
            const hex = PALETTE[t].slice(1), j = (y * WIDTH + x) * 4;
            mini_image.data[j] = parseInt(hex.slice(0, 2), 16); mini_image.data[j + 1] = parseInt(hex.slice(2, 4), 16); mini_image.data[j + 2] = parseInt(hex.slice(4, 6), 16); mini_image.data[j + 3] = 255;
        }
        this.mini.putImageData(mini_image, 0, 0);
        for (const v of world.villages.filter(v => v.alive)) { this.mini.fillStyle = v.color; this.mini.fillRect(v.x - 1, v.y - 1, 3, 3); }
        this.last_revision = world.revision;
    }
    cache_territory(world) {
        const living = world.villages.filter(v => v.alive);
        const owners = new Int16Array(WIDTH * HEIGHT).fill(-1);
        const image = this.territory_ctx.createImageData(WIDTH, HEIGHT);
        const colors = living.map(v => [1, 3, 5].map(i => parseInt(v.color.slice(i, i + 2), 16)));
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x;
            if (world.tiles[i] < T.SAND || world.tiles[i] > T.HILL) continue;
            let owner = -1, distance = Infinity;
            for (let k = 0; k < living.length; k++) {
                const dx = living[k].x - x, dy = living[k].y - y;
                const candidate = dx * dx + dy * dy;
                if (candidate < distance) { distance = candidate; owner = k; }
            }
            owners[i] = owner;
        }
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x, owner = owners[i];
            if (owner < 0) continue;
            const edge = (x > 0 && owners[i - 1] !== owner) || (x < WIDTH - 1 && owners[i + 1] !== owner)
                || (y > 0 && owners[i - WIDTH] !== owner) || (y < HEIGHT - 1 && owners[i + WIDTH] !== owner);
            const j = i * 4;
            image.data[j] = colors[owner][0]; image.data[j + 1] = colors[owner][1];
            image.data[j + 2] = colors[owner][2]; image.data[j + 3] = edge ? 190 : 35;
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
        const dense_kingdoms = world.villages.length >= 20;
        if (this.borders && dense_kingdoms) {
            if (now - this.territory_last > 1500) { this.cache_territory(world); this.territory_last = now; }
            c.drawImage(this.territory, 0, 0, WIDTH * CELL, HEIGHT * CELL);
        }
        const populations = new Map();
        const kingdoms = new Map(world.villages.map(v => [v.id, v]));
        const warring = new Set();
        for (const relation of world.relations) if (relation.status === 'war') {
            warring.add(relation.a); warring.add(relation.b);
        }
        for (const person of world.people) populations.set(person.village_id, (populations.get(person.village_id) || 0) + 1);
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
            const pop = populations.get(v.id) || 0;
            if (this.borders && !dense_kingdoms) {
                const at_war = warring.has(v.id);
                c.strokeStyle = at_war ? '#e7816dbb' : v.color + '85'; c.fillStyle = at_war ? '#e7816d12' : v.color + '0d'; c.lineWidth = 1 / s;
                c.setLineDash([3, 5]); c.beginPath(); c.arc(v.x * CELL, v.y * CELL, (9 + Math.sqrt(pop) * 1.1) * CELL, 0, Math.PI * 2); c.fill(); c.stroke(); c.setLineDash([]);
            }
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
            for (const h of v.houses) this.house(c, h.x * CELL, h.y * CELL, v.color, false);
            this.house(c, v.x * CELL, v.y * CELL, v.color, true);
        }
        for (const a of world.animals) {
            const x = Math.round(a.x * CELL), y = Math.round(a.y * CELL), wolf = a.species === 'wolf' || a.species === 'bear';
            c.fillStyle = '#13291f55'; c.fillRect(x - 2, y + 2, 6, 2);
            const coats = { wolf: '#747a7b', bear: '#885c3d', deer: '#c69a60', rabbit: '#ddd3c2', chicken: '#e3bd53', sheep: '#e6e5ca' };
            c.fillStyle = coats[a.species] || '#e6e5ca'; c.fillRect(x - (a.species === 'bear' ? 3 : 2), y - 1, a.species === 'bear' ? 7 : 5, 3);
            c.fillStyle = a.species === 'wolf' ? '#a3a2a0' : '#f5eed9'; c.fillRect(x + (a.dx < 0 ? -3 : 2), y - 2, 2, 2);
            c.fillStyle = '#46483a'; c.fillRect(x - 1, y + 2, 1, 1); c.fillRect(x + 2, y + 2, 1, 1);
        }
        for (const p of world.people) {
            const x = Math.round(p.x * CELL), y = Math.round(p.y * CELL);
            const v = kingdoms.get(p.village_id);
            c.fillStyle = '#22342466'; c.fillRect(x - 1, y + 2, 3, 1);
            c.fillStyle = v?.color || '#e4dfb2'; c.fillRect(x - 1, y - 1, 2, 3);
            c.fillStyle = '#f0cc9e'; c.fillRect(x - 1, y - 3, 2, 2);
            c.fillStyle = '#433c2a'; c.fillRect(x - 1, y - 4, 2, 1);
            if (p.race === 'elf') { c.fillStyle = '#d8edc0'; c.fillRect(x - 3, y - 3, 2, 1); c.fillRect(x + 1, y - 3, 2, 1); }
            if (p.race === 'dwarf') { c.fillStyle = '#d59b74'; c.fillRect(x - 1, y - 1, 2, 1); }
            c.fillStyle = '#3c4639'; c.fillRect(x + Math.round(Math.sin(now / 160 + p.id)), y + 2, 1, 1);
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
    }
    house(c, x, y, color, town) {
        const w = town ? 13 : 8, h = town ? 10 : 7;
        c.fillStyle = '#29392766'; c.fillRect(x - w / 2 + 2, y + 2, w + 2, 3);
        c.fillStyle = '#e3cd9c'; c.fillRect(x - w / 2, y - h, w, h);
        c.fillStyle = '#b0a075'; c.fillRect(x + w / 2 - 3, y - h, 3, h);
        c.fillStyle = '#855b3d'; c.fillRect(x - w / 2 - 1, y - h - 3, w + 2, 4);
        c.fillStyle = color; c.fillRect(x - w / 2 + 1, y - h - 5, w - 2, 3);
        c.fillStyle = '#574d38'; c.fillRect(x - 1, y - 4, 2, 4);
        c.fillStyle = '#f7dd8d'; c.fillRect(x - w / 2 + 1, y - 5, 1, 2);
        if (town) { c.fillStyle = '#665b3e'; c.fillRect(x + 3, y - 20, 1, 10); c.fillStyle = color; c.fillRect(x + 4, y - 20, 5, 3); }
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
