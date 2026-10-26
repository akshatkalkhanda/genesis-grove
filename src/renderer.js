import { FORESTRY, tree_clearings, tree_variation, TREE_BIOMES } from './forestry.js';
import { draw_compact, home_populations, settlement_labels, map_detail } from './map_readability.js';
import { Camera } from './camera.js';
import { draw_map_layer } from './map_layers.js';
import { army_visible, army_badge_hit, army_target, siege_markers, siege_badge_layout } from './army_inspector.js';
import { ship_position } from './ship_inspector.js';
import { draw_weather } from './weather_art.js';
import { WIDTH, HEIGHT, T, TECH_AGES, technology_level } from './simulation.js';
import { creature_stats } from './creatures.js';
import { night_opacity } from './daylight.js';
import { draw_tree, draw_weapon, draw_vehicle, draw_landmark } from './world_art.js';
import { draw_flag } from './heraldry.js';
import { draw_machine, draw_fortification } from './machine_art.js';
import { draw_daily_activity } from './daily_life_art.js';
import { draw_medical_building, draw_medical_person } from './medical_art.js';
import { CIVIC_TYPES } from './civic.js';
import { draw_civic_building } from './civic_art.js';
export const PALETTE = ['#174655', '#28717a', '#c0b981', '#83a85d', '#547b46', '#8d9068', '#8d9b8d', '#bf6336', '#696a56', '#429b67', '#c5aa59', '#bedee2', '#b75e55', '#8965a7', '#63b5bd', '#aa85c7', '#d9a75b'];
const CELL = 6;
function tile_hash(x, y) { return ((Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0) / 4294967295; }
export class Renderer extends Camera {
    constructor(canvas, minimap) {
        super(WIDTH, HEIGHT, CELL);
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
        this.layer = 'political';
        this.borders = true; this.pointer = null; this.brush = 4; this.tool = 'grass'; this.selected_kingdom_id = null;
        this.last_revision = -1; this.last_cache = 0;
        this.resize();
        new ResizeObserver(() => this.resize()).observe(canvas);
    }
    resize() {
        this.set_viewport(this.canvas.clientWidth, this.canvas.clientHeight);
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * this.dpr);
        this.canvas.height = Math.round(this.height * this.dpr);
    }
    army_at(world, point) {
        return [...world.armies].reverse().find(army =>
            world.villages.some(kingdom => kingdom.id === army.kingdom_id && kingdom.alive)
            && army_visible(army, this.layer, this.selected_kingdom_id, this.selected_army)
            && army_badge_hit(army, point, this.origin, this.scale));
    }
    sprite_factor(factor) {
        // Grow detail at town zoom, then stop artwork growth at four screen pixels
        // per artwork pixel. Saved anchors and the camera scale stay unchanged.
        return factor * Math.min(1, 4 / this.scale);
    }
    ship_at(world, point) {
        // Match the compact hull/sail extents rather than a broad world-radius.
        // A small screen-space minimum keeps tiny zoomed-out vessels clickable.
        let selected = null, distance = Infinity;
        for (const collection of ['voyages', 'trades', 'machines']) for (const vessel of world[collection]) {
            if (vessel.kind !== (collection === 'machines' ? 'boat' : 'ship')) continue;
            const selection = { kind: 'ship', collection, id: vessel.id };
            const anchor = ship_position(world, selection);
            if (!anchor) continue;
            const x = this.origin.x + anchor.x * CELL * this.scale;
            const y = this.origin.y + anchor.y * CELL * this.scale;
            const factor = this.sprite_factor(0.42) * this.scale;
            const [left, right, top, bottom] = collection === 'machines' ? [15, 17, 28, 9]
                : collection === 'voyages' ? [6, 9, 12, 5] : [6, 6, 10, 4];
            if (point.x < x - Math.max(12, left * factor) || point.x > x + Math.max(12, right * factor)
                || point.y < y - Math.max(12, top * factor) || point.y > y + Math.max(12, bottom * factor)) continue;
            const squared = (point.x - x) ** 2 + (point.y - y) ** 2;
            if (squared <= distance) { selected = selection; distance = squared; }
        }
        return selected;
    }
    cache(world) {
        const c = this.tc;
        const mini_image = this.mini.createImageData(WIDTH, HEIGHT);
        const clearings = tree_clearings(world);
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const t = world.tiles[y * WIDTH + x], h = tile_hash(x, y), px = x * CELL, py = y * CELL;
            c.fillStyle = PALETTE[t]; c.fillRect(px, py, CELL, CELL);
            c.fillStyle = h > 0.5 ? '#ffffff07' : '#00000008'; c.fillRect(px, py, CELL, CELL);
            if (!clearings[y * WIDTH + x] || t <= T.SHALLOW || t === T.HILL || t === T.MOUNTAIN || t === T.LAVA) {
                if (t === T.GRASS) {
                    if (h > 0.72) { c.fillStyle = '#a9c078'; c.fillRect(px + 1, py + 2, 1, 1); c.fillRect(px + 3, py + 4, 1, 1); }
                    if (h < 0.08) { c.fillStyle = '#c9cb93'; c.fillRect(px + 2, py + 3, 1, 1); }
                } else if (t === T.FOREST) {
                    c.fillStyle = '#73864d'; c.fillRect(px + 1, py + 3, 1, 1);
                    c.fillStyle = '#354c37'; c.fillRect(px + 4, py + 1, 1, 2);
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
                } else if (t === T.JUNGLE) {
                    c.fillStyle = '#246b4b'; c.fillRect(px + 1, py + 1, 4, 4);
                    c.fillStyle = '#75ce82'; c.fillRect(px + 2, py, 2, 2); c.fillRect(px, py + 2, 2, 2);
                } else if (t === T.SAVANNA) {
                    c.fillStyle = '#eed17b'; c.fillRect(px + 1, py + 1, 2, 1); c.fillRect(px + 4, py + 3, 1, 2);
                    if (h > 0.7) { c.fillStyle = '#6e834d'; c.fillRect(px + 2, py, 1, 4); }
                } else if (t === T.SNOW) {
                    c.fillStyle = '#ecf8ee'; c.fillRect(px + 1, py + 1, 3, 2); c.fillRect(px + 4, py + 4, 2, 1);
                    c.fillStyle = '#8dbcc4'; c.fillRect(px, py + 4, 2, 1);
                } else if (t === T.MAPLE) {
                    c.fillStyle = h > 0.5 ? '#e6915f' : '#e46a75'; c.fillRect(px + 1, py + 3, 2, 1);
                } else if (t === T.MUSHROOM) {
                    c.fillStyle = '#d1a8d1'; c.fillRect(px + 2, py + 2, 1, 3);
                    c.fillStyle = '#dfa6ec'; c.fillRect(px + 1, py + 1, 4, 2);
                    c.fillStyle = '#e9d3b2'; c.fillRect(px + 2, py + 1, 1, 1);
                } else if (t === T.CRYSTAL) {
                    c.fillStyle = '#a7eeee'; c.fillRect(px + 2, py, 1, 5); c.fillRect(px + 1, py + 2, 3, 2);
                    c.fillStyle = '#e1fbf6'; c.fillRect(px + 2, py + 1, 1, 2);
                } else if (t === T.CELESTIAL) {
                    c.fillStyle = '#e7b8e8'; c.fillRect(px + 2, py + 1, 1, 4); c.fillRect(px, py + 3, 5, 1);
                    c.fillStyle = '#fff3c9'; c.fillRect(px + 2, py + 2, 1, 1);
                } else if (t === T.DESERT) {
                    c.fillStyle = '#f1ce7f'; c.fillRect(px + 1, py + 1, 3, 1); c.fillRect(px + 3, py + 4, 3, 1);
                }
            }
            const ore = world.ores?.[y * WIDTH + x] || 0;
            if (ore && (h > 0.38 || t >= T.MOUNTAIN)) {
                c.fillStyle = ['', '#d77c50', '#ddc08a', '#c9d3d4', '#474a47', '#f3c7ff'][ore];
                c.fillRect(px + (h > 0.6 ? 1 : 3), py + (h > 0.6 ? 3 : 1), 2, 2);
            }
            const hex = PALETTE[t].slice(1), j = (y * WIDTH + x) * 4;
            mini_image.data[j] = parseInt(hex.slice(0, 2), 16); mini_image.data[j + 1] = parseInt(hex.slice(2, 4), 16); mini_image.data[j + 2] = parseInt(hex.slice(4, 6), 16); mini_image.data[j + 3] = 255;
        }
        // Roads follow walkable terrain and stay wide enough to read at world scale.
        for (let i = 0; i < world.roads.length; i++) {
            const grade = world.roads[i]; if (!grade || !world.walkable(i % WIDTH, Math.floor(i / WIDTH))) continue;
            const x = i % WIDTH * CELL, y = Math.floor(i / WIDTH) * CELL;
            c.fillStyle = grade === 3 ? '#384b50' : grade === 2 ? '#9da99b' : '#bda478';
            c.fillRect(x, y + 1, CELL, 4);
            if (world.roads[i - WIDTH] || world.roads[i + WIDTH]) c.fillRect(x + 1, y, 4, CELL);
            c.fillStyle = grade === 3 ? '#dbc98a' : grade === 2 ? '#c5c8b0' : '#d6bc84';
            c.fillRect(x + 2, y + 2, grade === 3 ? 2 : 1, 1);
        }
        const biomes = { [T.FOREST]: 'forest', [T.JUNGLE]: 'jungle', [T.MAPLE]: 'maple',
            [T.CELESTIAL]: 'celestial', [T.MUSHROOM]: 'mushroom', [T.SNOW]: 'snow', [T.SAVANNA]: 'savanna' };
        for (let y = 2; y < HEIGHT - 1; y += 2) for (let x = 1; x < WIDTH - 1; x += 2) {
            const i = y * WIDTH + x, biome = biomes[world.tiles[i]], h = tile_hash(x + 47, y + 19);
            if (!biome || clearings[i] || (['snow', 'savanna'].includes(biome) && h > 0.2)
                || world.roads[i] || world.roads[i - WIDTH] || world.roads[i + WIDTH]
                || world.roads[i - 1] || world.roads[i + 1]) continue;
            draw_tree(c, x * CELL + Math.floor(h * 5), y * CELL + 3, biome, h);
        }
        for (const [i, stump] of world.stumps) {
            if (world.tiles[i] !== T.GRASS || clearings[i] || world.roads[i]) continue;
            const x = i % WIDTH, y = Math.floor(i / WIDTH), h = tree_variation(x, y);
            const px = x * CELL + Math.floor(h * 5), py = y * CELL + 3;
            if (stump.age < FORESTRY.stump_seconds) {
                c.fillStyle = '#60462f'; c.fillRect(px - 1, py - 2, 3, 3);
                c.fillStyle = '#ceac73'; c.fillRect(px - 1, py - 2, 3, 1);
            } else {
                c.save(); c.translate(px, py); c.scale(0.35, 0.35);
                draw_tree(c, 0, 0, TREE_BIOMES[stump.biome], h); c.restore();
            }
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
        const sites = world.claim_sites();
        const owners = new Int32Array(WIDTH * HEIGHT).fill(-1);
        const image = this.territory_ctx.createImageData(WIDTH, HEIGHT);
        const boundaries = new Map();
        const colors = new Map([...kingdoms].map(([id, kingdom]) => [id, [1, 3, 5].map(i => parseInt(kingdom.color.slice(i, i + 2), 16))]));
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x;
            if (!world.walkable(x, y)) continue;
            owners[i] = world.territory_at(x, y, sites) ?? -1;
        }
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
            const i = y * WIDTH + x, owner = owners[i];
            if (owner < 0) continue;
            const lines = boundaries.get(owner) || [];
            const px = x * CELL, py = y * CELL;
            if (x === 0 || owners[i - 1] !== owner) lines.push([px, py, px, py + CELL]);
            if (x === WIDTH - 1 || owners[i + 1] !== owner) lines.push([px + CELL, py, px + CELL, py + CELL]);
            if (y === 0 || owners[i - WIDTH] !== owner) lines.push([px, py, px + CELL, py]);
            if (y === HEIGHT - 1 || owners[i + WIDTH] !== owner) lines.push([px, py + CELL, px + CELL, py + CELL]);
            boundaries.set(owner, lines);
            const j = i * 4;
            const color = colors.get(owner) || [215, 219, 196];
            image.data[j] = color[0]; image.data[j + 1] = color[1];
            image.data[j + 2] = color[2]; image.data[j + 3] = owner === this.selected_kingdom_id ? 30 : 16;
        }
        this.territory_ctx.putImageData(image, 0, 0);
        this.boundaries = boundaries;
    }
    render(world, now) {
        if (this.last_revision !== world.revision && now - this.last_cache > 220) { this.cache(world); this.last_cache = now; }
        const c = this.ctx, o = this.origin, s = this.scale;
        const detail = map_detail(s);
        const counts = { level: detail.level, houses: 0, facilities: 0, people: 0,
            markers: 0, activities: 0, names: 0, settlements: 0, sieges: 0,
            creature_pixel_scale: this.sprite_factor(0.55) * s,
            vehicle_pixel_scale: this.sprite_factor(0.42) * s };
        this.visibility = counts;
        const visible = unit => {
            const x = o.x + unit.x * CELL * s, y = o.y + unit.y * CELL * s;
            return x >= -80 && x <= this.width + 80 && y >= -80 && y <= this.height + 80;
        };
        c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        c.fillStyle = '#143e4b'; c.fillRect(0, 0, this.width, this.height);
        c.save(); c.translate(o.x, o.y); c.scale(s, s); c.imageSmoothingEnabled = false;
        c.drawImage(this.terrain, 0, 0);
        if (this.borders) {
            if (now - this.territory_last > 1500) { this.cache_territory(world); this.territory_last = now; }
            c.drawImage(this.territory, 0, 0, WIDTH * CELL, HEIGHT * CELL);
            for (const [owner, lines] of this.boundaries || []) {
                c.strokeStyle = `${world.villages.find(v => v.id === owner)?.color || '#d7dbc4'}bb`;
                c.lineWidth = 1.25 / s; c.beginPath();
                for (const [x1, y1, x2, y2] of lines) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
                c.stroke();
            }
        }
        const kingdoms = new Map(world.villages.map(v => [v.id, v]));
        const populations = home_populations(world);
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
            for (let j = 0; detail.buildings && j < Math.min(v.houses.length, 5); j++) {
                const h = v.houses[j], x = h.x * CELL + 8, y = h.y * CELL + 5;
                if (world.walkable(h.x + 2, h.y + 1)) {
                    c.fillStyle = '#7d7844'; c.fillRect(x, y, 8, 7);
                    c.fillStyle = '#c2ad60'; for (let k = 1; k < 8; k += 2) c.fillRect(x + k, y + 1, 1, 5);
                }
            }
            for (const h of detail.buildings ? v.houses : []) { counts.houses++; draw_compact(c, h.x * CELL, h.y * CELL, 0.5,
                () => this.house(c, h.x * CELL, h.y * CELL, v.color, false, technology_level(v)));
            }
            draw_compact(c, v.x * CELL, v.y * CELL, 0.5,
                () => this.house(c, v.x * CELL, v.y * CELL, v.color, true, technology_level(v), v));
            if (this.zoom >= 4) draw_compact(c, v.x * CELL, v.y * CELL, 0.45,
                () => this.industry(c, v.x * CELL, v.y * CELL, v));
            for (const building of detail.buildings ? v.buildings || [] : []) { counts.facilities++; draw_compact(c, building.x * CELL, building.y * CELL, 0.45,
                () => this.building(c, building, v.color, now, v));
            }
        }
        for (const colony of world.colonies) {
            const kingdom = kingdoms.get(colony.kingdom_id);
            if (!kingdom?.alive) continue;
            const inhabited = (populations.get(colony.id) || 0) > 0;
            if (!inhabited && this.selected_kingdom_id !== kingdom.id) {
                c.fillStyle = '#9ca59b88';
                c.fillRect(colony.x * CELL - 2, colony.y * CELL, 4, 2);
                continue;
            }
            c.globalAlpha = inhabited ? 1 : 0.25;
            for (const house of detail.buildings ? colony.houses : []) { counts.houses++; draw_compact(c, house.x * CELL, house.y * CELL, 0.5,
                () => this.house(c, house.x * CELL, house.y * CELL, kingdom.color, false, technology_level(kingdom)));
            }
            if (inhabited) draw_compact(c, colony.x * CELL, colony.y * CELL, 0.5,
                () => this.house(c, colony.x * CELL, colony.y * CELL, kingdom.color, true, technology_level(kingdom), kingdom));
            c.globalAlpha = 1;
        }
        for (const voyage of world.voyages) {
            const point = voyage.kind === 'ship' ? ship_position(world, { kind: 'ship', collection: 'voyages', id: voyage.id })
                : { x: voyage.x + (voyage.target_x - voyage.x) * voyage.progress,
                    y: voyage.y + (voyage.target_y - voyage.y) * voyage.progress };
            if (!point) continue;
            const x = point.x * CELL, y = point.y * CELL;
            draw_compact(c, x, y, this.sprite_factor(0.42), () => {
            c.fillStyle = '#352d26'; c.fillRect(x - 6, y + 2, 13, 3);
            c.fillStyle = voyage.kind === 'ship' ? '#e8e3c9' : '#bca87b';
            c.fillRect(x - 1, y - 8, 2, 10); c.fillRect(x + 1, y - 7, 5, 6);
            c.fillStyle = kingdoms.get(voyage.kingdom_id)?.color || '#e8e3c9'; c.fillRect(x - 5, y, 11, 2);
            draw_flag(c, x + 1, y - 12, kingdoms.get(voyage.kingdom_id) || {}, 8, 5);
            });
        }
        for (const trade of world.trades || []) {
            const sender = kingdoms.get(trade.from_id), recipient = kingdoms.get(trade.to_id);
            if (!sender || !recipient) continue;
            const point = trade.kind === 'ship' ? ship_position(world, { kind: 'ship', collection: 'trades', id: trade.id })
                : { x: sender.x + (recipient.x - sender.x) * trade.progress,
                    y: sender.y + (recipient.y - sender.y) * trade.progress };
            if (!point) continue;
            const x = point.x * CELL, y = point.y * CELL;
            draw_compact(c, x, y, this.sprite_factor(0.42), () => {
            c.fillStyle = trade.kind === 'ship' ? '#735b45' : '#8e724e'; c.fillRect(x - 6, y, 12, 4);
            c.fillStyle = trade.good === 'food' ? '#c6bb6d' : trade.good === 'wood' ? '#7e9d59' : '#a9b8b8'; c.fillRect(x - 3, y - 4, 6, 4);
            if (trade.kind === 'ship') { c.fillStyle = '#e9dfb8'; c.fillRect(x, y - 10, 1, 8); c.fillRect(x + 1, y - 9, 5, 5); }
            else { c.fillStyle = '#3f3b32'; c.fillRect(x - 4, y + 3, 2, 2); c.fillRect(x + 3, y + 3, 2, 2); }
            });
        }
        for (const vehicle of world.vehicles) draw_compact(c, vehicle.x * CELL, vehicle.y * CELL, this.sprite_factor(0.42),
            () => draw_vehicle(c, vehicle, kingdoms.get(vehicle.kingdom_id)?.color || '#b3c697', now));
        for (const machine of world.machines.filter(m => ['boat', 'artillery'].includes(m.kind))) {
            const kingdom = kingdoms.get(machine.kingdom_id);
            draw_compact(c, machine.x * CELL, machine.y * CELL, this.sprite_factor(0.42),
                () => draw_machine(c, machine, kingdom, now, technology_level(kingdom)));
        }
        for (const animal of world.animals.filter(visible)) {
            if (detail.people || animal.id === this.selected_unit_id) draw_compact(c, animal.x * CELL, animal.y * CELL, this.sprite_factor(0.55),
                () => this.animal(c, animal, now));
            else { c.fillStyle = '#bdc5a988'; c.fillRect(animal.x * CELL, animal.y * CELL, 1.5 / s, 1.5 / s); }
        }
        const aboard = new Set(world.machines.filter(m => m.crew_aboard).map(m => m.crew_id));
        for (const p of world.people) {
            if (p.voyage_id || aboard.has(p.id) || !visible(p)) continue;
            const selected = p.id === this.selected_unit_id;
            if (detail.people || selected) { counts.people++; draw_compact(c, p.x * CELL, p.y * CELL, this.sprite_factor(0.55),
                () => this.person(c, p, kingdoms.get(p.village_id), now, world.year_length));
            } else {
                counts.markers++;
                c.fillStyle = kingdoms.get(p.village_id)?.king_id === p.id ? '#f0ca65'
                    : kingdoms.get(p.village_id)?.color || '#d6dfb7';
                c.fillRect(p.x * CELL, p.y * CELL, 1.7 / s, 2 / s);
            }
            if (p.age >= world.year_length * 18 && ((detail.activities && counts.activities < 24) || selected)) { counts.activities++;
                draw_compact(c, p.x * CELL, p.y * CELL, this.sprite_factor(0.55),
                () => draw_daily_activity(c, p, world.time * 1000));
            }
        }
        for (const machine of world.machines.filter(m => ['balloon', 'plane', 'airship'].includes(m.kind))) {
            draw_compact(c, machine.x * CELL, machine.y * CELL, this.sprite_factor(0.42),
                () => draw_machine(c, machine, kingdoms.get(machine.kingdom_id), now));
        }
        if (this.selected_unit_id) {
            const selected = [...world.people, ...world.animals].find(unit => unit.id === this.selected_unit_id);
            if (selected) {
                c.strokeStyle = '#f5e8a8'; c.lineWidth = 1 / s;
                c.beginPath(); c.ellipse(selected.x * CELL, selected.y * CELL + Math.min(3, 6 / s),
                    Math.min(7, 13 / s), Math.min(4, 7 / s), 0, 0, Math.PI * 2); c.stroke();
            }
        }
        if (this.selected_ship) {
            const point = ship_position(world, this.selected_ship);
            if (point) {
                c.strokeStyle = '#f5e8a8'; c.lineWidth = 1.5 / s;
                c.beginPath(); c.ellipse(point.x * CELL, point.y * CELL + Math.min(2, 4 / s),
                    Math.max(10, Math.min(8 * s, 18)) / s,
                    Math.max(5, Math.min(4 * s, 9)) / s, 0, 0, Math.PI * 2); c.stroke();
            }
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
        draw_weather(c, world, CELL);
        // Drifting, translucent cloud shadows; all artwork is generated in code.
        for (let i = 0; i < 5; i++) {
            const x = ((now / 1700 + i * 241) % (WIDTH * CELL + 180)) - 100;
            const y = 90 + (i * 173) % (HEIGHT * CELL - 160);
            c.fillStyle = '#041e2b0b'; c.fillRect(x + 20, y + 30, 72, 15); c.fillRect(x + 35, y + 20, 48, 35);
            c.fillStyle = '#d6eee510'; c.fillRect(x, y, 55, 10); c.fillRect(x + 13, y - 8, 28, 25);
        }
        const darkness = night_opacity(world.lighting?.phase ?? 0.5);
        if (darkness > 0) {
            c.fillStyle = `rgba(7,16,48,${darkness})`; c.fillRect(0, 0, WIDTH * CELL, HEIGHT * CELL);
            for (const village of world.villages.filter(v => v.alive)) {
                c.fillStyle = `rgba(255,211,115,${darkness * 2})`;
                for (const house of village.houses) c.fillRect(house.x * CELL - 2, house.y * CELL - 5, 2, 2);
            }
        }
        draw_map_layer(c, world, this.layer, CELL);
        if (this.touch_preview?.length && this.tool !== 'inspect') {
            c.strokeStyle = '#f2e5a6cc'; c.lineWidth = 2 / s;
            c.setLineDash([4 / s, 4 / s]); c.beginPath();
            for (const [index, point] of this.touch_preview.entries()) {
                if (index) c.lineTo(point.x * CELL, point.y * CELL);
                else c.moveTo(point.x * CELL, point.y * CELL);
            }
            c.stroke(); c.setLineDash([]);
            const last = this.touch_preview.at(-1);
            c.beginPath(); c.arc(last.x * CELL, last.y * CELL, this.brush * CELL, 0, Math.PI * 2); c.stroke();
        }
        if (this.pointer) {
            const p = this.world_point(this.pointer.x, this.pointer.y);
            if (world.inside(p.x, p.y)) {
                c.strokeStyle = '#f0f5d6dc'; c.fillStyle = '#edfad40e'; c.lineWidth = 1.2 / s;
                c.beginPath(); c.arc((Math.floor(p.x) + 0.5) * CELL, (Math.floor(p.y) + 0.5) * CELL,
                    this.tool === 'inspect' ? Math.min(0.7 * CELL, 12 / s) : this.brush * CELL, 0, Math.PI * 2); c.fill(); c.stroke();
                const dot = this.tool === 'inspect' ? Math.min(1, 2 / s) : 1;
                c.fillStyle = '#eff7d8'; c.fillRect(p.x * CELL - dot, p.y * CELL - dot, dot * 2, dot * 2);
            }
        }
        c.restore();
        const label_boxes = (world.armies || []).filter(army =>
            army_visible(army, this.layer, this.selected_kingdom_id, this.selected_army))
            .map(army => ({ x: o.x + army.x * CELL * s - 14,
                y: o.y + army.y * CELL * s - 29, width: 31, height: 22 }));
        const labeled_units = [...world.people, ...world.animals]
            .filter(unit => detail.names || unit.id === this.selected_unit_id)
            .sort((a, b) => Number(b.id === this.selected_unit_id) - Number(a.id === this.selected_unit_id));
        for (const unit of labeled_units) {
            if (counts.names >= 6) break;
            if (unit.voyage_id || unit.health <= 0) continue;
            const x = o.x + unit.x * CELL * s, y = o.y + unit.y * CELL * s - Math.min(76, 17 * s) - 8;
            if (x < 48 || x > this.width - 48 || y < 105 || y > this.height - 30) continue;
            const box = { x: x - 48, y: y - 14, width: 96, height: unit.task ? 34 : 23 };
            if (label_boxes.some(other => box.x < other.x + other.width + 4
                && box.x + box.width + 4 > other.x && box.y < other.y + other.height + 4
                && box.y + box.height + 4 > other.y)) continue;
            label_boxes.push(box);
            counts.names++;
            const stats = creature_stats(unit, world.year_length);
            c.font = '600 10px -apple-system, Segoe UI, sans-serif'; c.textAlign = 'center';
            c.fillStyle = '#15251fdd'; c.fillRect(x - 48, y - 14, 96, unit.task ? 34 : 23);
            c.fillStyle = '#e9efd3'; c.fillText(`${unit.name?.split(' ')[0] || unit.species} · Lv ${stats.level}`, x, y - 3);
            c.fillStyle = '#385041'; c.fillRect(x - 28, y + 2, 56, 3);
            c.fillStyle = '#a7d479'; c.fillRect(x - 28, y + 2, 56 * Math.max(0, unit.health / stats.max_health), 3);
            if (unit.task) {
                c.font = '9px -apple-system, Segoe UI, sans-serif'; c.fillStyle = '#b8c8b1';
                let task = unit.task;
                while (task.length > 1 && c.measureText(task).width > 84) task = task.slice(0, -1);
                c.fillText(task === unit.task ? task : `${task.slice(0, -1)}…`, x, y + 15);
            }
        }
        for (const army of world.armies || []) {
            if (!army_visible(army, this.layer, this.selected_kingdom_id, this.selected_army)) continue;
            const kingdom = kingdoms.get(army.kingdom_id);
            if (!kingdom?.alive) continue;
            const x = o.x + army.x * CELL * s, y = o.y + army.y * CELL * s;
            if (x < -30 || x > this.width + 30 || y < -30 || y > this.height + 30) continue;
            const target = army_target(world, army);
            if (target && ['march', 'attack'].includes(army.state) && (this.zoom > 1.4 || army.kingdom_id === this.selected_kingdom_id || this.layer === 'armies')) {
                c.strokeStyle = `${kingdom.color}77`; c.lineWidth = 1.5; c.setLineDash([4, 4]);
                c.beginPath(); c.moveTo(x, y); c.lineTo(o.x + target.x * CELL * s, o.y + target.y * CELL * s); c.stroke(); c.setLineDash([]);
            }
            c.fillStyle = '#11221ce8'; c.fillRect(x - 12, y - 27, 27, 18);
            if (this.selected_army?.home_id === army.home_id && this.selected_army?.kingdom_id === army.kingdom_id) {
                c.strokeStyle = '#f2e4a3'; c.lineWidth = 2;
                c.strokeRect(x - 14, y - 29, 31, 22);
            }
            c.fillStyle = '#dedfc4'; c.fillRect(x - 8, y - 24, 2, 15);
            draw_flag(c, x - 6, y - 24, kingdom, 12, 8);
            c.fillStyle = '#eff4df'; c.font = 'bold 9px -apple-system, Segoe UI, sans-serif'; c.textAlign = 'center';
            c.fillText(String(army.count), x + 9, y - 15);
            label_boxes.push({ x: x - 14, y: y - 29, width: 31, height: 22 });
        }
        for (const marker of siege_markers(world, this.selected_army)) {
            if (counts.sieges >= 6) break;
            const box = siege_badge_layout(marker, { origin: o, scale: s,
                width: this.width, height: this.height }, label_boxes);
            if (!box) continue;
            const { x, y, width, height } = box;
            c.fillStyle = '#172820f2'; c.beginPath(); c.roundRect(x, y, width, height, 4); c.fill();
            c.strokeStyle = marker.selected ? '#f2e4a3' : '#a59463'; c.lineWidth = marker.selected ? 2 : 1;
            c.stroke();
            c.fillStyle = '#eee4bd'; c.font = '600 10px -apple-system, Segoe UI, sans-serif'; c.textAlign = 'left';
            c.fillText(`${marker.siege.kind === 'capital' ? 'Capital' : 'Town'} · ${Math.floor(marker.siege.percent)}%`, x + 6, y + 12);
            c.fillStyle = '#40503a'; c.fillRect(x + 6, y + 18, width - 12, 4);
            c.fillStyle = '#d8bf7a'; c.fillRect(x + 6, y + 18, (width - 12) * marker.siege.percent / 100, 4);
            label_boxes.push(box); counts.sieges++;
        }
        if (this.borders) for (const label of settlement_labels(world, {
            zoom: this.zoom, selected: this.selected_kingdom_id, origin: o, scale: s,
            width: this.width, height: this.height, reserved: label_boxes
        }, populations, (name, capital) => {
            c.font = `${capital ? '600 11px' : '500 10px'} -apple-system, Segoe UI, sans-serif`;
            return c.measureText(name).width;
        })) {
            counts.settlements++;
            const { x, y, width, height, site, capital, owner } = label;
            c.fillStyle = '#152d24e8'; c.beginPath(); c.roundRect(x, y, width, height, 5); c.fill();
            if (capital) draw_flag(c, x + 6, y + 7, kingdoms.get(owner), 14, 9);
            c.font = `${capital ? '600 11px' : '500 10px'} -apple-system, Segoe UI, sans-serif`;
            c.fillStyle = kingdoms.get(owner)?.color || '#e8e3c9'; c.textAlign = 'left';
            c.fillText(site.name, x + (capital ? 26 : 8), y + (capital ? 15 : 14));
        }
    }
    animal(c, animal, now = 0) {
        const x = Math.round(animal.x * CELL), y = Math.round(animal.y * CELL);
        const face = animal.dx < 0 ? -1 : 1;
        if (['angel', 'demon'].includes(animal.species)) {
            const angel = animal.species === 'angel', flap = Math.round(Math.sin(now / 240 + animal.id) * 3);
            c.fillStyle = angel ? '#f3edd0' : '#703a49';
            for (const side of [-1, 1]) {
                c.beginPath(); c.moveTo(x + side * 2, y - 8); c.lineTo(x + side * 17, y - 15 - flap);
                c.lineTo(x + side * 13, y - 3); c.lineTo(x + side * 4, y); c.fill();
                c.fillStyle = angel ? '#b7d3cd' : '#a9504c';
                c.fillRect(x + side * 10 - 1, y - 8, 2, 5);
                c.fillStyle = angel ? '#f3edd0' : '#703a49';
            }
            c.fillStyle = angel ? '#e8f1dd' : '#b45142'; c.fillRect(x - 4, y - 9, 9, 12);
            c.fillStyle = angel ? '#f2d2a5' : '#df8060'; c.fillRect(x - 3, y - 15, 6, 6);
            c.fillStyle = '#edc968';
            if (angel) { c.fillRect(x - 4, y - 19, 9, 1); c.fillRect(x - 5, y - 18, 1, 2); c.fillRect(x + 5, y - 18, 1, 2); }
            else { c.fillRect(x - 5, y - 20, 2, 7); c.fillRect(x + 3, y - 20, 2, 7); c.fillStyle = '#f29c55'; c.fillRect(x - 3, y + 3, 2, 3); c.fillRect(x + 2, y + 3, 2, 3); }
            c.fillStyle = angel ? '#cbad59' : '#552d30'; c.fillRect(x + face * 7, y - 16, 2, 20);
            c.fillStyle = angel ? '#fff1a9' : '#f4ac5d'; c.fillRect(x + face * 7 - 2, y - 18, 6, 3);
            return;
        }
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
        } else if (['fox', 'cat', 'hyena', 'boar', 'buffalo'].includes(animal.species)) {
            const color = { fox: '#d78249', cat: '#ccad72', hyena: '#aa875d', boar: '#745441', buffalo: '#664b40' }[animal.species];
            const large = animal.species === 'buffalo';
            c.fillStyle = color; c.fillRect(x - (large ? 7 : 5), y - 4, large ? 14 : 10, large ? 9 : 6);
            c.fillRect(x + face * 5 - 2, y - 6, large ? 6 : 4, 6);
            c.fillStyle = animal.species === 'fox' ? '#f1dfbe' : '#524338';
            c.fillRect(x - face * 7, y - 2, animal.species === 'fox' ? 4 : 2, 2);
            if (animal.species === 'buffalo' || animal.species === 'boar') {
                c.fillStyle = '#e8d8aa'; c.fillRect(x + face * 6 - 3, y - 9, 2, 4); c.fillRect(x + face * 8 - 2, y - 8, 2, 3);
            } else {
                c.fillStyle = color; c.fillRect(x + face * 4 - 2, y - 9, 2, 4); c.fillRect(x + face * 7 - 2, y - 8, 2, 3);
            }
            if (animal.species === 'hyena') { c.fillStyle = '#443b35'; c.fillRect(x - 3, y - 5, 2, 2); c.fillRect(x + 1, y - 3, 2, 2); }
        } else if (['frog', 'beetle', 'turtle', 'lizard'].includes(animal.species)) {
            const color = { frog: '#62b96b', beetle: '#62aab5', turtle: '#648b65', lizard: '#99a65c' }[animal.species];
            c.fillStyle = color; c.fillRect(x - 4, y - 2, 8, 5);
            if (animal.species === 'beetle' || animal.species === 'turtle') {
                c.fillStyle = animal.species === 'beetle' ? '#328295' : '#476b50'; c.fillRect(x - 3, y - 4, 6, 4);
                c.fillStyle = '#a9d4a5'; c.fillRect(x, y - 3, 1, 3);
            } else if (animal.species === 'frog') {
                c.fillStyle = '#daf2a2'; c.fillRect(x - 3, y - 5, 2, 2); c.fillRect(x + 2, y - 5, 2, 2);
            } else { c.fillStyle = color; c.fillRect(x - face * 7, y + 1, 5, 2); }
            c.fillStyle = '#354a37'; c.fillRect(x - 4, y + 3, 2, 2); c.fillRect(x + 3, y + 3, 2, 2);
        } else if (['owl', 'butterfly', 'moth'].includes(animal.species)) {
            const insect = animal.species !== 'owl';
            c.fillStyle = animal.species === 'owl' ? '#9b7b64' : animal.species === 'moth' ? '#c4ceb0' : '#d89bd2';
            c.fillRect(x - (insect ? 6 : 4), y - 5, insect ? 12 : 8, 6);
            c.fillStyle = animal.species === 'owl' ? '#e3c590' : '#9ce1d1'; c.fillRect(x - 2, y - 4, 4, 5);
            if (animal.species === 'owl') { c.fillStyle = '#eddfb0'; c.fillRect(x - 3, y - 7, 2, 3); c.fillRect(x + 2, y - 7, 2, 3); }
            else { c.fillStyle = '#f0dbee'; c.fillRect(x - 5, y - 6, 2, 3); c.fillRect(x + 4, y - 6, 2, 3); }
        } else {
            c.fillStyle = '#e8e9df'; c.fillRect(x - 5, y - 3, 9, 6); c.fillRect(x - 4, y - 5, 3, 3); c.fillRect(x, y - 5, 3, 3);
            c.fillStyle = '#454a42'; c.fillRect(x + face * 5 - 2, y - 4, 4, 5);
        }
        c.fillStyle = '#2e302b'; c.fillRect(x + face * 6 - 1, y - 4, 1, 1);
        c.fillStyle = '#473b2e'; c.fillRect(x - 3, y + 2, 1, 3); c.fillRect(x + 2, y + 2, 1, 3);
    }
    person(c, person, kingdom, now, year_length = 20) {
        const x = Math.round(person.x * CELL), y = Math.round(person.y * CELL);
        const level = person.weapon_level || 0, armor = person.armor_level || 0, face = person.dx < 0 ? -1 : 1;
        const skin = { orc: '#8fbc6c', dwarf: '#d69b75', foxfolk: '#d88953', harefolk: '#e7d6be', catfolk: '#d5b078', frogfolk: '#78c991', wolfkin: '#aab9c4', hyenafolk: '#b99566', beetlefolk: '#68aaa1' }[person.race] || '#f0c9a0';
        c.fillStyle = '#172a2266'; c.fillRect(x - 3, y + 3, 7, 2);
        const stationary = person.medical_role || person.recovering
            ? ['Receiving treatment', 'Waiting for treatment', 'Recovering at home', 'Tending patients', 'Awaiting medicinal herbs'].includes(person.task) || person.medical_work?.timer > 0
            : person.role !== 'soldier' && ['work', 'rest', 'social'].includes(person.daily_life?.phase);
        const stride = stationary ? 0 : Math.round(Math.sin(now / 140 + person.id));
        c.fillStyle = '#3f443c'; c.fillRect(x - 2, y + 1 + stride, 2, 4); c.fillRect(x + 1, y + 1 - stride, 2, 4);
        c.fillStyle = kingdom?.color || '#e4dfb2'; c.fillRect(x - 3, y - 4, 6, 6);
        c.fillStyle = '#213129'; c.fillRect(x - 3, y, 6, 1);
        c.fillStyle = skin; c.fillRect(x - 2, y - 8, 4, 4);
        c.fillStyle = person.race === 'elf' ? '#e5d9a2' : person.race === 'orc' ? '#344330' : ['frogfolk', 'beetlefolk'].includes(person.race) ? '#426b60' : '#493d32';
        c.fillRect(x - 2, y - 9, 4, 2);
        if (person.role === 'soldier') { c.fillStyle = TECH_AGES[Math.max(level, 1)].color; c.fillRect(x - 3, y - 10, 6, 2); c.fillRect(x - 3, y - 4, 1, 4); c.fillRect(x + 2, y - 4, 1, 4); }
        if (person.race === 'elf') { c.fillStyle = skin; c.fillRect(x - 4, y - 7, 2, 1); c.fillRect(x + 2, y - 7, 2, 1); }
        if (person.race === 'dwarf') { c.fillStyle = '#a5683f'; c.fillRect(x - 2, y - 5, 4, 3); }
        if (person.race === 'orc') { c.fillStyle = '#e9dfb8'; c.fillRect(x - 3, y - 5, 1, 2); c.fillRect(x + 2, y - 5, 1, 2); }
        if (['foxfolk', 'catfolk', 'wolfkin', 'hyenafolk'].includes(person.race)) {
            c.fillStyle = skin; c.fillRect(x - 3, y - 11, 2, 4); c.fillRect(x + 1, y - 11, 2, 4);
            c.fillRect(x - face * 5, y - 3, 3, 2);
        }
        if (person.race === 'harefolk') { c.fillStyle = skin; c.fillRect(x - 3, y - 14, 2, 7); c.fillRect(x + 1, y - 14, 2, 7); }
        if (person.race === 'frogfolk') { c.fillStyle = '#e4f0af'; c.fillRect(x - 3, y - 9, 2, 2); c.fillRect(x + 2, y - 9, 2, 2); }
        if (person.race === 'beetlefolk') { c.fillStyle = '#477e83'; c.fillRect(x - 3, y - 10, 6, 3); c.fillRect(x - 4, y - 3, 2, 4); c.fillRect(x + 2, y - 3, 2, 4); }
        if (armor > 0) { c.fillStyle = TECH_AGES[armor].color; c.fillRect(x - 4, y - 3, 2, 4); c.fillRect(x + 2, y - 3, 2, 4); }
        if (armor >= 9 && (this.zoom >= 9 || person.id === this.selected_unit_id)) {
            // The armor silhouette carries the tier; a permanent aura obscures neighbors.
            c.fillStyle = TECH_AGES[armor].color; c.fillRect(x - 3, y - 10, 6, 2);
        }
        c.fillStyle = '#e3d4bd'; c.fillRect(x - 1, y - 2, 2, 2);
        const metal = TECH_AGES[level].color;
        if (person.age >= year_length * 18 && (person.role === 'soldier' || (!stationary && (this.zoom >= 9 || person.id === this.selected_unit_id)))) draw_weapon(c, x, y + Math.round(Math.sin(now / 250 + person.id)), level, face, metal,
            level >= 6 && person.attack_timer > (level === 6 ? 1.8 : 0.6));
        if (level < 5 && (level >= 2 || person.role === 'soldier')) {
            c.fillStyle = metal; c.fillRect(x - face * 5 - 2, y - 4, 4, 6);
            c.fillStyle = kingdom?.color || '#b4be9b'; c.fillRect(x - face * 5 - 1, y - 3, 2, 4);
        }
        if (level >= 7 && person.role === 'soldier') {
            c.fillStyle = '#4d6356'; c.fillRect(x - 4, y - 10, 8, 3);
            c.fillStyle = '#a8bcb0'; c.fillRect(x - 2, y - 10, 3, 1);
        }
        draw_medical_person(c, person);
        if (kingdom?.king_id === person.id) {
            c.fillStyle = '#f0ca65'; c.fillRect(x - 4, y - 13, 8, 3);
            c.fillRect(x - 4, y - 16, 2, 4); c.fillRect(x - 1, y - 15, 2, 3); c.fillRect(x + 2, y - 16, 2, 4);
            c.fillStyle = '#c98061'; c.fillRect(x - 1, y - 12, 2, 1);
        }
        if (person.prisoner_of) {
            c.fillStyle = '#909d9d'; c.fillRect(x - 6, y - 1, 13, 1);
            c.fillRect(x - 6, y - 2, 2, 3); c.fillRect(x + 5, y - 2, 2, 3);
        }
    }
    house(c, x, y, color, town, level = 0, kingdom = null) {
        const w = town ? 13 : 8, h = town ? 10 : 7;
        if (level >= 9) {
            const glow = TECH_AGES[level].color;
            c.fillStyle = '#243e4b66'; c.fillRect(x - w / 2 - 2, y + 1, w + 5, 4);
            c.fillStyle = '#526c80'; c.fillRect(x - w / 2, y - 23, w, 24);
            c.fillStyle = '#334b64'; c.fillRect(x + w / 2 - 3, y - 23, 3, 24);
            c.fillStyle = glow; c.fillRect(x - w / 2 - 1, y - 25, w + 2, 3);
            for (let row = 0; row < 3; row++) {
                c.fillStyle = glow; c.fillRect(x - w / 2 + 1, y - 20 + row * 5, 2, 2);
                c.fillRect(x + w / 2 - 3, y - 20 + row * 5, 2, 2);
            }
            c.fillStyle = color; c.fillRect(x - w / 2, y - 3, w, 2);
            if (town) {
                c.fillStyle = '#c6d4c8'; c.fillRect(x, y - 42, 1, 17);
                draw_flag(c, x + 1, y - 42, kingdom || { color }, 14, 9);
            }
            return;
        }
        if (level >= 5) {
            const floors = level >= 8 ? 3 : level >= 7 ? 2 : 1;
            const height = 9 + floors * 5;
            c.fillStyle = '#29392766'; c.fillRect(x - w / 2, y + 1, w + 4, 4);
            c.fillStyle = level >= 8 ? '#becdca' : '#c4aa89'; c.fillRect(x - w / 2, y - height, w, height);
            c.fillStyle = level >= 8 ? '#496a75' : '#745c58'; c.fillRect(x - w / 2 - 1, y - height - 3, w + 2, 4);
            c.fillStyle = color; c.fillRect(x - w / 2, y - height + 1, w, 2);
            for (let floor = 0; floor < floors; floor++) {
                c.fillStyle = '#355c69'; c.fillRect(x - w / 2 + 1, y - 8 - floor * 5, 2, 3);
                c.fillStyle = '#bedcce'; c.fillRect(x + w / 2 - 3, y - 8 - floor * 5, 2, 3);
            }
            c.fillStyle = '#414e49'; c.fillRect(x - 1, y - 4, 2, 4);
            if (town) {
                c.fillStyle = '#dfcf9a'; c.fillRect(x - 2, y - height - 16, 2, 13);
                draw_flag(c, x, y - height - 16, kingdom || { color }, 13, 8);
            }
            return;
        }
        c.fillStyle = '#29392766'; c.fillRect(x - w / 2 + 2, y + 2, w + 2, 3);
        c.fillStyle = level >= 3 ? '#b9c0bd' : level >= 2 ? '#ddc99d' : '#e3cd9c'; c.fillRect(x - w / 2, y - h, w, h);
        c.fillStyle = '#b0a075'; c.fillRect(x + w / 2 - 3, y - h, 3, h);
        c.fillStyle = level >= 4 ? '#6198a9' : level >= 3 ? '#596b77' : level >= 2 ? '#a47444' : '#855b3d'; c.fillRect(x - w / 2 - 1, y - h - 3, w + 2, 4);
        c.fillStyle = color; c.fillRect(x - w / 2 + 1, y - h - 5, w - 2, 3);
        c.fillStyle = '#574d38'; c.fillRect(x - 1, y - 4, 2, 4);
        c.fillStyle = '#f7dd8d'; c.fillRect(x - w / 2 + 1, y - 5, 1, 2);
        if (town) { c.fillStyle = '#665b3e'; c.fillRect(x + 3, y - 25, 1, 15); draw_flag(c, x + 4, y - 25, kingdom || { color }, 13, 8); }
        if (town && level >= 2) { c.fillStyle = level >= 3 ? '#aeb6b1' : '#bc9968'; c.fillRect(x - 10, y - 15, 4, 15); c.fillRect(x + 8, y - 13, 4, 13); }
    }
    building(c, building, color, now, kingdom = null) {
        const x = building.x * CELL, y = building.y * CELL;
        if (CIVIC_TYPES.has(building.type)) {
            draw_civic_building(c, building, color);
        } else if (['clinic', 'hospital'].includes(building.type)) {
            draw_medical_building(c, building, color);
        } else if (['castle', 'watchtower', 'prison', 'dock', 'aerodrome'].includes(building.type)) {
            draw_fortification(c, building, kingdom || { color });
        } else if (building.type === 'farm') {
            c.fillStyle = '#60482f'; c.fillRect(x - 10, y - 5, 21, 14);
            const crop = building.growth > 0.7 ? '#e6c367' : building.growth > 0.3 ? '#87ae51' : '#83613c';
            for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
                c.fillStyle = crop; c.fillRect(x - 8 + col * 3, y - 3 + row * 3, 1, 2);
            }
            c.fillStyle = '#c8b48b'; c.fillRect(x - 11, y + 9, 23, 1);
        } else if (building.type === 'windmill') {
            c.fillStyle = '#d3c5a0'; c.fillRect(x - 4, y - 14, 9, 17);
            c.fillStyle = '#875a48'; c.beginPath(); c.moveTo(x - 6, y - 14); c.lineTo(x, y - 21); c.lineTo(x + 6, y - 14); c.fill();
            c.save(); c.translate(x, y - 12); c.rotate(now / 1900);
            for (let arm = 0; arm < 4; arm++) {
                c.rotate(Math.PI / 2); c.fillStyle = '#69513a'; c.fillRect(0, -1, 14, 1);
                c.fillStyle = '#e4dcb6'; c.fillRect(4, 0, 10, 3);
            }
            c.restore(); c.fillStyle = '#533f2c'; c.fillRect(x - 1, y, 3, 4);
        } else if (building.type === 'armory') {
            c.fillStyle = '#a8b5ad'; c.fillRect(x - 8, y - 11, 17, 14);
            c.fillStyle = '#52697a'; c.fillRect(x - 10, y - 15, 21, 5);
            c.fillStyle = color; c.fillRect(x - 7, y - 9, 3, 6);
            c.fillStyle = '#e2d8ac'; c.fillRect(x + 2, y - 9, 1, 8); c.fillRect(x, y - 5, 5, 1);
            c.fillStyle = '#3c4947'; c.fillRect(x - 2, y - 2, 4, 5);
        } else if (building.type === 'camp') {
            c.fillStyle = '#776748'; c.fillRect(x - 11, y, 23, 9);
            c.fillStyle = color; c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x - 3, y - 10); c.lineTo(x + 4, y); c.fill();
            c.fillStyle = '#c1a574'; c.fillRect(x + 6, y - 8, 2, 14);
            c.fillRect(x + 2, y - 5, 10, 2);
            c.fillStyle = '#594b35'; c.fillRect(x + 5, y - 12, 4, 4);
            c.fillStyle = '#e6d18d'; c.fillRect(x - 7, y + 4, 2, 2);
        } else draw_landmark(c, building, color, now);
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
        const x = e.x * CELL, y = e.y * CELL, r = Math.min(e.radius * CELL, 48 / this.scale);
        c.save(); c.globalAlpha = e.life;
        if (e.type === 'tree_fall') {
            const progress = 1 - e.life;
            c.translate(x, y); c.rotate(progress * progress * Math.PI / 2);
            draw_tree(c, 0, 0, e.biome, e.variation);
        } else if (e.type === 'tree_chop') {
            c.fillStyle = '#dbbd81';
            for (let n = 0; n < 4; n++) {
                const progress = 1 - e.life, side = n % 2 ? 1 : -1;
                c.fillRect(x + side * (2 + n * progress * 3), y - 2 - Math.sin(progress * Math.PI) * 4, 1, 1);
            }
        } else if (e.type === 'shell') {
            const progress = 1 - e.life;
            const px = x + (e.target_x * CELL - x) * progress;
            const py = y + (e.target_y * CELL - y) * progress - Math.sin(progress * Math.PI) * Math.min(26, 42 / this.scale);
            c.fillStyle = '#292d2b'; c.beginPath(); c.arc(px, py, Math.min(2.5, 4 / this.scale), 0, Math.PI * 2); c.fill();
            if (progress > 0.8) {
                c.fillStyle = '#edb56d99'; c.beginPath(); c.arc(e.target_x * CELL, e.target_y * CELL, Math.min(9, 24 / this.scale) * progress, 0, Math.PI * 2); c.fill();
            }
        } else if (e.type === 'beam') {
            c.strokeStyle = e.color || '#c3f4f0'; c.lineWidth = Math.min(3, 3 / this.scale) * e.life;
            c.beginPath(); c.moveTo(x, y - 8); c.lineTo(e.target_x * CELL, e.target_y * CELL - 6); c.stroke();
            c.strokeStyle = '#edfff8'; c.lineWidth = Math.min(1, 1 / this.scale) * e.life; c.stroke();
        } else if (e.type === 'shot' || e.type === 'bolt') {
            const progress = 1 - e.life;
            const tx = e.target_x * CELL, ty = e.target_y * CELL - 6;
            c.strokeStyle = e.type === 'bolt' ? '#dfc89a' : '#ffeda0'; c.lineWidth = Math.min(e.type === 'bolt' ? 1 : 1.5, 2 / this.scale);
            c.beginPath(); c.moveTo(x + (tx - x) * Math.max(0, progress - 0.25), y - 6 + (ty - y + 6) * Math.max(0, progress - 0.25));
            c.lineTo(x + (tx - x) * progress, y - 6 + (ty - y + 6) * progress); c.stroke();
        } else if (e.type === 'lightning') {
            const footprint = Math.min(1, 160 / (140 * this.scale));
            c.strokeStyle = '#f7f8c0'; c.lineWidth = Math.min(3, 3 / this.scale);
            c.beginPath(); c.moveTo(x + 20 * footprint, y - 140 * footprint);
            c.lineTo(x - 6 * footprint, y - 70 * footprint); c.lineTo(x + 9 * footprint, y - 72 * footprint); c.lineTo(x, y); c.stroke();
            c.fillStyle = '#ffffc433'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        } else if (e.type === 'meteor') {
            const progress = 1 - e.life;
            c.strokeStyle = '#fdba69'; c.lineWidth = Math.min(4, 3 / this.scale);
            c.beginPath(); c.arc(x, y, r * (0.5 + progress * 2), 0, Math.PI * 2); c.stroke();
            c.fillStyle = '#ffe6a866'; c.beginPath(); c.arc(x, y, r * (1 - progress), 0, Math.PI * 2); c.fill();
            for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; c.fillStyle = '#ffd68d'; c.fillRect(x + Math.cos(a) * r * progress * 2, y + Math.sin(a) * r * progress * 2, Math.min(3, 3 / this.scale), Math.min(3, 3 / this.scale)); }
        } else if (e.type === 'rain') {
            c.strokeStyle = '#9dd9e4'; c.lineWidth = Math.min(1, 1 / this.scale);
            for (let i = 0; i < 23; i++) { const dx = Math.sin(i * 17) * r, dy = ((i * 13 + now / 25) % (r * 2)) - r; c.beginPath(); c.moveTo(x + dx, y + dy - Math.min(5, 7 / this.scale)); c.lineTo(x + dx - Math.min(2, 3 / this.scale), y + dy + Math.min(2, 3 / this.scale)); c.stroke(); }
        } else {
            c.globalAlpha *= 0.6;
            c.strokeStyle = '#e1ed95'; c.lineWidth = Math.min(1.5, 2 / this.scale);
            c.beginPath(); c.arc(x, y, r * (1.2 - e.life * 0.4), 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + now / 1500; c.fillStyle = '#efffc6'; c.fillRect(x + Math.cos(a) * r / 2, y + Math.sin(a) * r / 2 - (1 - e.life) * Math.min(15, 16 / this.scale), Math.min(2, 2 / this.scale), Math.min(2, 2 / this.scale)); }
        }
        c.restore();
    }
}
