import { World, WIDTH, HEIGHT, T, TERRAIN_NAMES, TECH_AGES, RESEARCH_COSTS, RESEARCH_BUILDINGS, RACES, ANIMALS, technology_level } from './simulation.js';
import { Renderer } from './renderer.js';
import { creature_stats } from './creatures.js';
import { BUILDINGS } from './settlements.js';
import { advance_daylight } from './daylight.js';
import { VEHICLES } from './infrastructure.js';
import { draw_flag } from './heraldry.js';
import { MACHINES } from './machines.js';
import { CIVIC_DESCRIPTIONS, farm_target, food_reserve } from './civic.js';
import { advance_detention } from './defenses.js';
import { draw_tree } from './world_art.js';
import { ruler_personality, society_modifiers } from './society.js';
import { DAMAGE_CAUSES, health_risks } from './health.js';
import { MEDICAL_BUILDINGS } from './medicine.js';
const $ = id => document.getElementById(id);
function kingdom_flag(kingdom) {
    const flag = document.createElement('canvas'); flag.width = 40; flag.height = 28;
    flag.className = 'kingdom-flag'; flag.setAttribute('role', 'img');
    flag.setAttribute('aria-label', `${kingdom.name} flag`);
    draw_flag(flag.getContext('2d'), 2, 2, kingdom, 36, 24);
    return flag;
}
const TOOLS = {
    terrain: [
        ['grass', 'Meadow', '◆', '#a7c47b', 'Lay down fertile ground. Every great civilization starts somewhere.'],
        ['forest', 'Forest', '♠', '#8eb66c', 'Plant a living forest. Trees spread naturally and give villagers wood.'],
        ['ocean', 'Deep ocean', '≈', '#6aafc4', 'Carve oceans and separate continents. Land creatures cannot cross water.'],
        ['shallow', 'Shallows', '≋', '#82c7bb', 'Shape gentle coastlines with clear, shallow water.'],
        ['sand', 'Sand', '⠿', '#dfcb93', 'Paint golden beaches and quiet deserts. Life grows slowly here.'],
        ['desert', 'Desert', '☀', '#e4b567', 'Warm dunes where catfolk can thrive.'],
        ['savanna', 'Savanna', '✳', '#d5bd65', 'Dry golden grassland suited to hyena clans.'],
        ['jungle', 'Jungle', '♣', '#52b87b', 'Dense green canopy with food and timber for frogfolk.'],
        ['snow', 'Snowfield', '❄', '#c4e7e7', 'Cold white land favored by wolfkin.'],
        ['maple', 'Maple grove', '✿', '#e98d7a', 'Warm red woodland where harefolk flourish.'],
        ['mushroom', 'Mushroom glade', '◕', '#ab83cb', 'A violet forest rich in curious growth.'],
        ['crystal', 'Crystal wilds', '✧', '#75d2d5', 'Shimmering stone loved by beetlefolk.'],
        ['celestial', 'Starbloom', '✦', '#cba7ed', 'A luminous magical woodland.'],
        ['hill', 'Highlands', '▰', '#a6b18b', 'Raise rolling highlands. A rugged home for adventurous settlers.'],
        ['mountain', 'Mountain', '▲', '#c3cec3', 'Raise impassable peaks. Nature has its own boundaries.'],
        ['lava', 'Lava', '♨', '#e8a26e', 'Pour molten rock. It cools to ash, and eventually life returns.']
    ],
    life: [
        ['human', 'Humans', '♟', '#e3cf9a', 'Place three settlers. Humans gather food reliably across all kinds of land.'],
        ['elf', 'Elves', '♧', '#a8d89b', 'Forest folk who gather timber faster and thrive among trees.'],
        ['dwarf', 'Dwarves', '⛏', '#d7a878', 'Hardy highland settlers who gather food from rugged land.'],
        ['orc', 'Orcs', '♜', '#99bd7a', 'Tough settlers who grow quickly and favor border raids.'],
        ['foxfolk', 'Foxfolk', '♞', '#ed9a63', 'Quick settlers who forage well in mushroom glades.'],
        ['harefolk', 'Harefolk', '♟', '#f2d8bb', 'Fast-growing woodland settlers at home in maple groves.'],
        ['catfolk', 'Catfolk', '♧', '#ddbd82', 'Desert settlers skilled at finding food among dunes.'],
        ['frogfolk', 'Frogfolk', '♣', '#80caa2', 'Jungle settlers comfortable under dense canopies.'],
        ['wolfkin', 'Wolfkin', '♜', '#b6c9dc', 'Hardy northern clans that endure snowfields.'],
        ['hyenafolk', 'Hyenafolk', '♞', '#d0af71', 'Savanna clans that fight fiercely and grow quickly.'],
        ['beetlefolk', 'Beetlefolk', '⬡', '#8dbdaf', 'Armored crystal-land settlers with patient builders.'],
    ],
    creatures: [
        ['sheep', 'Sheep', '🐑', '#e9e3ca', 'Gentle grazers that feed on meadows and raise little flocks.'],
        ['wolf', 'Wolves', '🐺', '#b9bec4', 'Pack hunters that chase sheep and deer.'],
        ['deer', 'Deer', '🦌', '#c79d69', 'Shy forest grazers that flee from predators.'],
        ['bear', 'Bears', '🐻', '#b6825b', 'Powerful, territorial predators that hunt nearby wildlife.'],
        ['rabbit', 'Rabbits', '🐇', '#e0d7c5', 'Quick little grazers that multiply in fertile meadows.'],
        ['chicken', 'Chickens', '🐓', '#e8c866', 'Peaceful birds that forage and grow their flocks.'],
        ['fox', 'Foxes', '🦊', '#dd9561', 'Swift hunters that stalk small grazers.'],
        ['cat', 'Wildcats', '🐈', '#d3b16c', 'Quiet predators that roam the warm lands.'],
        ['frog', 'Frogs', '🐸', '#77c77d', 'Tiny amphibians that multiply in green places.'],
        ['beetle', 'Beetles', '🐞', '#80b6aa', 'Bright shelled insects that spread through the undergrowth.'],
        ['hyena', 'Hyenas', '🐾', '#c6a66c', 'Pack hunters at home on savannas.'],
        ['owl', 'Owls', '🦉', '#aa907c', 'Nocturnal hunters that seek small prey.'],
        ['boar', 'Boars', '🐗', '#99724e', 'Sturdy foragers that breed in woodlands.'],
        ['turtle', 'Turtles', '🐢', '#78a387', 'Slow, hardy grazers along the coast.'],
        ['buffalo', 'Buffalo', '♉', '#8d6248', 'Large herd animals of open grassland.'],
        ['butterfly', 'Butterflies', '🦋', '#dba8db', 'Colorful pollinators of flowered land.'],
        ['moth', 'Moths', '✿', '#c7d3af', 'Moonlit insects of forests and starbloom.'],
        ['lizard', 'Lizards', '🦎', '#94ad67', 'Small sun-loving reptiles of the desert.'],
        ['angel', 'Angels', '♧', '#f1e6ae', 'Winged guardians that heal nearby creatures, cure infection, quench fires, and fight demons.'],
        ['demon', 'Demons', '♆', '#e19174', 'Dangerous flying creatures that attack villagers and ignite the land. Angels can fight them.']
    ],
    powers: [
        ['copper', 'Copper vein', '◆', '#dc9464', 'Place a copper deposit. Miners can collect it for copper-age research and weapons.'],
        ['tin', 'Tin vein', '◇', '#c4a778', 'Place tin for bronze research and bronze equipment.'],
        ['iron', 'Iron vein', '⬟', '#aab8c4', 'Place iron for iron-age research, swords, and armor.'],
        ['coal', 'Coal seam', '⬢', '#9a9d91', 'Place coal to fuel advanced research and forge work.'],
        ['stardust', 'Stardust deposit', '✧', '#e8b8f5', 'Place cosmic dust for advanced research and energy weapons. Observatories also collect it slowly from the sky.'],
        ['rain', 'Rain', '☂', '#9ecde0', 'Quench fire, cool lava, and turn ash back into fertile meadow.'],
        ['fire', 'Fire', '♨', '#e3a16a', 'Spark a wildfire. Flames spread through meadows and forests.'],
        ['lightning', 'Lightning', 'ϟ', '#eee1a3', 'Strike the earth with thunder. Nearby creatures and forests feel its power.'],
        ['meteor', 'Meteor', '☄', '#e7a288', 'Bring down a star. Leave a crater of ash and molten rock.'],
        ['nuke', 'Nuclear bomb', '☢', '#d99175', 'A devastating blast that scorches a wide crater and sets the land ablaze.'],
        ['plague', 'Plague', '☣', '#a4bd83', 'Infect nearby creatures. The sickness spreads until they recover or perish.'],
        ['acid', 'Acid rain', '♨', '#a3c77c', 'A caustic storm that poisons the soil and harms creatures.'],
        ['bless', 'Blessing', '✦', '#e1e9a4', 'A gentler touch. Restore health and fertility to a patch of the world.'],
        ['erase', 'Remove life', '◇', '#c2aaa0', 'Make room for another beginning. Remove creatures and buildings.']
    ]
};
TOOLS.plants = TOOLS.terrain.filter(item => ['forest', 'jungle', 'maple', 'mushroom', 'celestial'].includes(item[0]));
const CATALOG_INFO = {
    terrain: 'Shape the landscape · drag to paint',
    life: 'Civilizations · each click places three settlers on land',
    creatures: 'Wildlife & mythical beings · click land to place one',
    plants: 'Living biomes · paint woodland for food and timber',
    powers: 'World powers · choose a tool, then use it on the map'
};
const LIFE_TOOLS = new Set([...Object.keys(RACES), ...ANIMALS]);
let world = new World({ preset: 'empty', inhabited: false });
const renderer = new Renderer($('world'), $('minimap'));
let category = 'terrain', tool = 'grass', previous_tool = 'grass', brush = 4, paused = false, speed = 1;
let focused_village_id = null;
let inspected_unit = null;
let followed_unit_id = null;
let pointer_down = false, panning = false, last_pointer = null, paint_elapsed = 0, last_paint = null;
let toast_timer, audio_context, audio_gain, sound_on = false;
const storage_key = 'genesis-grove-world-v1';
let world_started = false;
function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toast_timer); toast_timer = setTimeout(() => { $('toast').hidden = true; }, 3300);
}
function select_tool(id) {
    tool = id; renderer.tool = id;
    document.body.classList.toggle('inspecting', id === 'inspect');
    if (id !== 'inspect') { inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; }
    $('inspect').classList.toggle('active', id === 'inspect');
    $('world-tooltip').hidden = true;
    if (id === 'inspect') {
        $('selected-icon').textContent = '⌕'; $('selected-name').textContent = 'Inspect world';
        $('selected-description').textContent = 'Move over land for tile details. Click a person or animal for its own profile.';
        $('selected-action').textContent = 'CLICK A CREATURE OR HOVER OVER LAND';
    } else {
        previous_tool = id;
        const item = Object.values(TOOLS).flat().find(t => t[0] === id);
        $('selected-icon').textContent = item[2]; $('selected-name').textContent = item[1]; $('selected-description').textContent = item[4];
        $('selected-action').textContent = LIFE_TOOLS.has(id) ? 'CLICK WALKABLE LAND TO PLACE' : 'DRAG ON THE MAP TO APPLY';
    }
    const tool_name = $('selected-name').textContent;
    const instruction = id === 'inspect' ? 'Click a creature for details' : LIFE_TOOLS.has(id) ? 'Click land to place' : 'Drag on the map to apply';
    $('interaction-hint').replaceChildren();
    const hint_name = document.createElement('b'); hint_name.textContent = `${tool_name} selected`;
    const hint_action = document.createElement('span'); hint_action.textContent = `${instruction} · right-drag to move · scroll to zoom`;
    $('interaction-hint').append(hint_name, hint_action);
    $('footer-status').replaceChildren();
    const footer_icon = document.createElement('span'); footer_icon.textContent = $('selected-icon').textContent;
    $('footer-status').append(footer_icon, `${tool_name} · ${instruction.toLowerCase()}`);
    $('brush').closest('.brush-section').hidden = id === 'inspect' || LIFE_TOOLS.has(id);
    for (const button of $('tools').children) {
        button.classList.toggle('active', button.dataset.tool === id);
        button.setAttribute('aria-pressed', String(button.dataset.tool === id));
    }
}
function show_tools() {
    $('catalog-summary').textContent = CATALOG_INFO[category];
    $('tools').replaceChildren();
    for (const [id, name, glyph, color, description] of TOOLS[category]) {
        const button = document.createElement('button'); button.className = 'tool'; button.dataset.tool = id;
        button.style.setProperty('--tool-color', color); button.title = `${name}: ${description}`;
        button.setAttribute('aria-label', `${name}. ${description}`);
        const icon = document.createElement('span'); icon.className = 'glyph'; icon.textContent = glyph;
        const label = document.createElement('span'); label.textContent = name;
        if (LIFE_TOOLS.has(id) || category === 'plants') {
            const art = document.createElement('canvas'); art.width = 64; art.height = 48;
            art.className = 'catalog-portrait'; art.setAttribute('aria-hidden', 'true');
            const context = art.getContext('2d'); context.imageSmoothingEnabled = false;
            const scale = category === 'plants' || ['angel', 'demon'].includes(id) ? 1.5 : 2.5;
            context.setTransform(scale, 0, 0, scale, 32, 36);
            const unit = { id: 1, x: 0, y: 0, age: 20, health: 100, race: id, species: id, role: 'civilian', job: 'farmer', weapon_level: 0, armor_level: 0 };
            if (RACES[id]) renderer.person(context, unit, { color }, 0);
            else if (ANIMALS.includes(id)) renderer.animal(context, unit);
            else draw_tree(context, 0, 0, id, 0.6);
            button.append(art);
        } else button.append(icon);
        button.append(label); button.onclick = () => select_tool(id); $('tools').append(button);
    }
    select_tool(TOOLS[category].some(t => t[0] === tool) ? tool : TOOLS[category][0][0]);
}
for (const tab of document.querySelectorAll('[data-category]')) tab.onclick = () => {
    category = tab.dataset.category;
    for (const other of document.querySelectorAll('[data-category]')) other.setAttribute('aria-selected', String(other === tab));
    show_tools();
};
$('guide-land').onclick = () => { document.querySelector('[data-category="terrain"]').click(); select_tool('grass'); };
$('guide-people').onclick = () => { document.querySelector('[data-category="life"]').click(); select_tool('human'); };
$('guide-time').onclick = () => set_pause(false);
$('toggle-controls').onclick = () => {
    const collapsed = document.body.classList.toggle('controls-collapsed');
    const button = $('toggle-controls');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Show creator controls' : 'Collapse creator controls');
    button.title = collapsed ? 'Show creator controls' : 'Collapse creator controls';
    button.textContent = collapsed ? '›' : '‹';
};
$('brush').oninput = () => { brush = Number($('brush').value); renderer.brush = brush; $('brush-value').textContent = `${brush} ${brush === 1 ? 'tile' : 'tiles'}`; };
function set_pause(value) {
    paused = value; $('pause').textContent = paused ? '▶ Resume' : 'Ⅱ Pause'; $('pause').setAttribute('aria-label', paused ? 'Resume time' : 'Pause time'); $('paused-banner').hidden = !paused;
    update_world_guidance();
}
$('pause').onclick = () => set_pause(!paused);
function set_speed(value) {
    speed = value;
    for (const button of document.querySelectorAll('[data-speed]')) button.classList.toggle('active', Number(button.dataset.speed) === speed);
}
for (const button of document.querySelectorAll('[data-speed]')) button.onclick = () => { set_speed(Number(button.dataset.speed)); set_pause(false); };
const MIN_ZOOM = 0.65, MAX_ZOOM = 24;
function zoom_slider_value(zoom) { return Math.round(Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM) * 100); }
function update_zoom() {
    $('zoom-reset').textContent = `${Math.round(renderer.zoom * 100)}%`;
    $('zoom-slider').value = String(zoom_slider_value(renderer.zoom));
}
$('zoom-slider').oninput = () => {
    const zoom = MIN_ZOOM * (MAX_ZOOM / MIN_ZOOM) ** (Number($('zoom-slider').value) / 100);
    renderer.zoom_at(zoom / renderer.zoom); update_zoom();
};
$('zoom-in').onclick = () => { renderer.zoom_at(1.15); update_zoom(); };
$('zoom-out').onclick = () => { renderer.zoom_at(1 / 1.15); update_zoom(); };
$('zoom-reset').onclick = $('fit').onclick = () => { followed_unit_id = null; renderer.fit(); update_zoom(); };
$('borders').onclick = () => { renderer.borders = !renderer.borders; $('borders').classList.toggle('active', renderer.borders); };
$('inspect').onclick = () => select_tool(tool === 'inspect' ? previous_tool : 'inspect');
function research_status(kingdom) {
    const next_level = technology_level(kingdom) + 1, next = TECH_AGES[next_level];
    if (!next) return 'All fourteen ages discovered';
    const resources = Object.entries(RESEARCH_COSTS[next_level]).map(([ore, amount]) =>
        `${Math.floor(Math.min(amount, kingdom.ore?.[ore] || 0))}/${amount} ${ore}`).join(' · ');
    const institution = RESEARCH_BUILDINGS[next_level];
    const building = institution && !kingdom.buildings?.some(b => b.type === institution)
        ? ` · needs ${BUILDINGS[institution].label.toLowerCase()}` : '';
    return `Next: ${next.name} · knowledge ${Math.floor(kingdom.tech_points || 0)}/${next.threshold} · ${resources}${building}`;
}
$('technology').onclick = () => {
    const unlocks = ['First tools, farms, and training camps', 'Copper spears, windmills, and watchtowers',
        'Bronze blades, armor, armories, harvest carts, docks, and coastal boats', 'Iron swords, stone roads, and prisons',
        'Steel equipment, castles, and founders monuments', 'Crossbows, universities, and workshops',
        'Muskets, artillery, and visible ranged combat', 'Rifles, factories, steam wagons, paved roads, aerodromes, and survey balloons',
        'Carbines, supply trucks, courier aircraft, taller buildings, and observatories',
        'Photon lances, hovercraft, flying transports, and astral forges',
        'Plasma projectors and luminous architecture',
        'Void beams, stardust carriers, and stargate monuments',
        'Sovereign rays and cosmic dust condensers',
        'Stardust staffs and the most advanced armor'];
    $('technology-list').replaceChildren(...TECH_AGES.map((age, index) => {
        const row = document.createElement('div'); row.className = 'technology-step';
        row.style.setProperty('--age-color', age.color);
        const number = document.createElement('span'); number.textContent = String(index + 1);
        const title = document.createElement('strong'); title.textContent = age.name;
        const detail = document.createElement('small'); detail.textContent = unlocks[index];
        row.append(number, title, detail); return row;
    }));
    $('technology-dialog').showModal();
};
function local_point(event) {
    const rect = $('world').getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function paint(p, continuous = false) {
    if (tool === 'inspect') return;
    if (continuous && (['meteor', 'nuke', 'lightning'].includes(tool) || LIFE_TOOLS.has(tool))) return;
    const tile = renderer.world_point(p.x, p.y);
    if (!world.inside(tile.x, tile.y)) return;
    if (LIFE_TOOLS.has(tool) && !world.walkable(tile.x, tile.y)) { toast('Place life on walkable land.'); return; }
    if (last_paint && !['meteor', 'nuke', 'lightning', 'rain', 'bless'].includes(tool) && !LIFE_TOOLS.has(tool)) {
        const distance = Math.hypot(tile.x - last_paint.x, tile.y - last_paint.y);
        const steps = Math.min(100, Math.ceil(distance / Math.max(1, brush / 2)));
        for (let i = 1; i < steps; i++) world.apply(tool, last_paint.x + (tile.x - last_paint.x) * i / steps, last_paint.y + (tile.y - last_paint.y) * i / steps, brush);
    }
    const before_life = LIFE_TOOLS.has(tool) ? world.people.length + world.animals.length : 0;
    world.apply(tool, tile.x, tile.y, brush); last_paint = tile;
    if (LIFE_TOOLS.has(tool)) {
        const placed = world.people.length + world.animals.length - before_life;
        toast(placed ? `${placed} ${RACES[tool] ? 'settlers' : 'creature'} placed. Choose Inspect to follow their story.` : 'No life placed. This world may have reached its population limit.');
    }
    if (['meteor', 'lightning'].includes(tool)) power_sound(tool);
}
const canvas = $('world');
canvas.oncontextmenu = event => event.preventDefault();
canvas.onpointerdown = event => {
    if (![0, 1, 2].includes(event.button)) return;
    const p = local_point(event); last_pointer = p; renderer.pointer = p;
    if (event.button === 0 && !event.altKey && tool === 'inspect') { inspect_click(p); return; }
    panning = event.button !== 0 || event.altKey;
    pointer_down = !panning; last_paint = null; paint_elapsed = 0;
    canvas.setPointerCapture(event.pointerId);
    if (pointer_down) paint(p);
    if (panning) { followed_unit_id = null; canvas.style.cursor = 'grabbing'; }
};
canvas.onpointermove = event => {
    const p = local_point(event);
    if (panning && last_pointer) { renderer.pan_x += p.x - last_pointer.x; renderer.pan_y += p.y - last_pointer.y; }
    last_pointer = p; renderer.pointer = p;
    if (tool === 'inspect') inspect(p);
};
function end_pointer(event) {
    pointer_down = false; panning = false; last_paint = null; canvas.style.cursor = 'crosshair';
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.onpointerup = canvas.onpointercancel = end_pointer;
canvas.onpointerleave = () => { if (!pointer_down && !panning) renderer.pointer = null; $('world-tooltip').hidden = true; };
window.addEventListener('blur', () => end_pointer());
canvas.onwheel = event => {
    event.preventDefault(); const p = local_point(event);
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
    renderer.zoom_at(Math.exp(-delta * 0.001), p.x, p.y); update_zoom();
};
$('minimap').onclick = event => {
    followed_unit_id = null;
    const rect = $('minimap').getBoundingClientRect();
    renderer.focus((event.clientX - rect.left) / rect.width * WIDTH, (event.clientY - rect.top) / rect.height * HEIGHT); update_zoom();
};
function inspect(p) {
    if (inspected_unit) { $('world-tooltip').hidden = true; return; }
    const tile = renderer.world_point(p.x, p.y);
    if (!world.inside(tile.x, tile.y)) { $('world-tooltip').hidden = true; return; }
    const box = $('world-tooltip'); box.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = TERRAIN_NAMES[world.tile(tile.x, tile.y)]; box.append(heading);
    const add = text => { const line = document.createElement('div'); line.textContent = text; box.append(line); };
    add(`Position ${Math.floor(tile.x)}, ${Math.floor(tile.y)}`);
    const people = world.people.filter(u => Math.hypot(u.x - tile.x, u.y - tile.y) < 5).length;
    const animals = world.animals.filter(u => Math.hypot(u.x - tile.x, u.y - tile.y) < 5).length;
    add(`${people} people · ${animals} animals nearby`);
    const deposit = world.ores[world.index(tile.x, tile.y)];
    if (deposit) add(['', 'Copper vein', 'Tin vein', 'Iron vein', 'Coal seam', 'Stardust deposit'][deposit]);
    const road = world.roads[world.index(tile.x, tile.y)];
    if (road) add(`${['', 'Dirt road', 'Stone road', 'Paved road'][road]} · movement +${road * 15}%`);
    const vehicle = world.vehicles.find(v => Math.hypot(v.x - tile.x, v.y - tile.y) < 2);
    if (vehicle) add(`${VEHICLES[vehicle.kind].label} · ${vehicle.cargo} food aboard · ${vehicle.deliveries} deliveries`);
    const machine = world.machines.find(m => Math.hypot(m.x - tile.x, m.y - tile.y) < 3);
    if (machine) {
        add(`${MACHINES[machine.kind].label} · ${Math.ceil(machine.health)} health · ${machine.cargo} food aboard`);
        const crew = world.people.find(p => p.id === machine.crew_id && p.health > 0);
        add(crew ? `Crew: ${crew.name} · ${machine.crew_aboard ? 'Aboard · click to inspect' : 'Boarding vehicle'}` : 'Awaiting crew · not operating');
    }
    const site = [...world.colonies, ...world.villages.filter(v => v.alive)].find(v => Math.hypot(v.x - tile.x, v.y - tile.y) < 9);
    const claimed_by = world.villages.find(v => v.id === world.territory_at(tile.x, tile.y));
    add(claimed_by ? `${claimed_by.name} territory` : 'Unclaimed land');
    if (site) {
        const kingdom = site.kingdom_id ? world.villages.find(v => v.id === site.kingdom_id) : site;
        add(site.name); add(`${kingdom?.name || 'Lost kingdom'} · ${site.houses.length} homes`);
        if (kingdom) {
            add(`${Math.floor(kingdom.food)} food · ${Math.floor(kingdom.wood)} wood`);
            const soldiers = world.people.filter(p => p.village_id === kingdom.id && p.role === 'soldier').length;
            add(`${soldiers} soldiers${kingdom.barracks ? ' · barracks' : ''}`);
        }
    }
    if (world.fire[world.index(tile.x, tile.y)] > 0) add('Burning · use rain to extinguish');
    for (const kingdom of world.villages.filter(v => v.alive)) {
        const building = kingdom.buildings?.find(b => Math.hypot(b.x - tile.x, b.y - tile.y) < 2);
        if (building && MEDICAL_BUILDINGS.has(building.type)) add(`${BUILDINGS[building.type].label} · ${(building.stock || 0).toFixed(1)} medicine · ${building.treatments || 0} completed treatments`);
        else if (building) {
            add(`${BUILDINGS[building.type].label}${building.type === 'farm' ? ` · crop ${Math.floor(building.growth * 100)}% · ${building.harvests} harvests` : building.type === 'granary' ? ` · ${(building.stock || 0).toFixed(1)} grain stored` : ` · ${Math.ceil(building.integrity ?? 100)} integrity`}`);
            if (CIVIC_DESCRIPTIONS[building.type]) add(CIVIC_DESCRIPTIONS[building.type]);
        }
    }
    add('Click a person or animal to inspect it');
    box.hidden = false; box.style.left = `${Math.max(5, Math.min(p.x + 18, renderer.width - 205))}px`; box.style.top = `${Math.max(70, Math.min(p.y + 18, renderer.height - 150))}px`;
}
function inspect_click(p) {
    const tile = renderer.world_point(p.x, p.y);
    const found = world.unit_near(tile.x, tile.y);
    inspected_unit = found ? { kind: found.kind, id: found.unit.id } : null;
    renderer.selected_unit_id = found?.unit.id || null;
    followed_unit_id = null;
    const card = $('entity-card'); card.hidden = !found;
    if (found) {
        document.body.classList.remove('info-open');
        $('world-info').classList.remove('active');
    }
    if (found) {
        update_entity_card();
        card.style.left = `${Math.max(8, Math.min(p.x + 16, canvas.clientWidth - card.offsetWidth - 8))}px`;
        card.style.top = `${Math.max(8, Math.min(p.y + 16, canvas.clientHeight - card.offsetHeight - 8))}px`;
        $('world-tooltip').hidden = true;
    }
}
function update_entity_card() {
    if (!inspected_unit) return;
    const unit = (inspected_unit.kind === 'person' ? world.people : world.animals).find(u => u.id === inspected_unit.id);
    if (!unit) { inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; toast('This creature has left the world. Its story has ended.'); return; }
    const attributes = creature_stats(unit, world.year_length);
    const card = $('entity-card');
    const scroll_top = card.scrollTop;
    const focused_action = card.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    card.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'entity-heading';
    const name = document.createElement('strong');
    name.textContent = unit.name;
    const close = document.createElement('button'); close.dataset.action = 'close-creature'; close.textContent = '×'; close.setAttribute('aria-label', 'Close creature details');
    close.onclick = () => { inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; card.hidden = true; };
    heading.append(name, close); card.append(heading);
    const portrait = document.createElement('canvas'); portrait.width = 64; portrait.height = 64; portrait.className = 'entity-portrait';
    const art = portrait.getContext('2d'); art.imageSmoothingEnabled = false; art.setTransform(3, 0, 0, 3, 32, 47);
    if (inspected_unit.kind === 'person') renderer.person(art, { ...unit, x: 0, y: 0 }, world.villages.find(v => v.id === unit.village_id), performance.now());
    else renderer.animal(art, { ...unit, x: 0, y: 0 });
    card.append(portrait);
    const activity = document.createElement('div'); activity.className = 'entity-activity';
    activity.textContent = `${followed_unit_id === unit.id ? '◉ Following · ' : ''}${unit.task || (inspected_unit.kind === 'person' ? 'Exploring' : 'Roaming the wilds')}`;
    card.append(activity);
    const health = document.createElement('div'); health.className = 'entity-health';
    health.setAttribute('role', 'meter'); health.setAttribute('aria-label', 'Health');
    health.setAttribute('aria-valuemin', '0'); health.setAttribute('aria-valuemax', String(attributes.max_health)); health.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(unit.health))));
    const meter = document.createElement('span'); meter.style.width = `${Math.max(0, Math.min(100, unit.health / attributes.max_health * 100))}%`; health.append(meter); card.append(health);
    const line = (label, value) => { const row = document.createElement('div'); row.className = 'entity-row'; const key = document.createElement('span'); key.textContent = label; const val = document.createElement('b'); val.textContent = String(value); row.append(key, val); card.append(row); };
    line('Species', `${inspected_unit.kind === 'person' ? RACES[unit.race]?.label || 'Human' : unit.species} · #${unit.id}`);
    line('Health', `${Math.ceil(unit.health)} / ${attributes.max_health}`);
    const condition = unit.infection > 0 ? 'Infected' : unit.health < attributes.max_health * 0.35
        ? 'Badly hurt' : unit.health < attributes.max_health * 0.9 ? 'Wounded' : 'Healthy';
    line('Condition', condition);
    const risks = health_risks(world, unit, world.villages.find(v => v.id === unit.village_id));
    line('Health risks', risks.join(' · ') || 'None detected');
    const harm = unit.health_history?.[0];
    line('Last harm', harm ? `${DAMAGE_CAUSES[harm.cause]} · −${harm.amount.toFixed(1)} HP · Year ${Math.floor(harm.time / world.year_length) + 1}` : 'No damage recorded yet');
    if (unit.health_history?.length > 1) {
        const history = document.createElement('details'); history.className = 'damage-history';
        const title = document.createElement('summary'); title.textContent = 'Recent damage'; history.append(title);
        for (const entry of unit.health_history.slice(1, 5)) {
            const row = document.createElement('p');
            row.textContent = `${DAMAGE_CAUSES[entry.cause]} · −${entry.amount.toFixed(1)} HP · Year ${Math.floor(entry.time / world.year_length) + 1}`;
            history.append(row);
        }
        card.append(history);
    }
    line('Age', `${Math.floor(unit.age / world.year_length)} years`);
    line('Level / XP', `${attributes.level} · ${Math.floor(unit.xp || 0)} / ${attributes.next_xp ?? 'Master'}`);
    line('Strength / Intelligence', `${attributes.strength} / ${attributes.intelligence}`);
    line('Trait', unit.trait || 'Unknown');
    line('Kills', unit.kills || 0);
    line('Terrain', TERRAIN_NAMES[world.tile(unit.x, unit.y)]);
    if (inspected_unit.kind === 'person') {
        const kingdom = world.villages.find(v => v.id === unit.village_id);
        line('Kingdom', kingdom?.name || 'No kingdom');
        line('Food supply', kingdom ? `${Math.floor(kingdom.food)} shared · ${kingdom.food < 5 ? 'Food shortage' : 'Available'}` : 'No shared stores');
        if (kingdom?.king_id === unit.id) line('Title', 'Ruler');
        const vessel = world.machines.find(m => m.crew_id === unit.id);
        line('Role', vessel ? `${vessel.kind === 'boat' ? 'Sailor' : vessel.kind === 'artillery' ? 'Gunner' : 'Pilot'} · ${MACHINES[vessel.kind].label}` : unit.medical_role === 'doctor' ? 'Doctor' : unit.role === 'soldier' ? 'Soldier' : `${unit.job || 'civilian'} · civilian`);
        if (unit.recovering || unit.medical_role) {
            const clinics = kingdom?.buildings?.filter(b => MEDICAL_BUILDINGS.has(b.type)) || [];
            const doctors = world.people.filter(p => p.village_id === kingdom?.id && p.medical_role === 'doctor' && p.health > 0);
            line('Medical care', unit.medical_role ? unit.task : !clinics.length ? 'No clinic · recovering at home'
                : !doctors.length ? 'Clinic needs a healthy adult doctor'
                    : clinics.every(b => !b.stock) ? 'Waiting for medicinal supplies' : unit.task);
        }
        line('Weapon', TECH_AGES[unit.weapon_level || 0].weapon);
        line('Armor', unit.armor_level ? `${TECH_AGES[unit.armor_level].name} armor` : 'None');
        if (unit.parents?.length) line('Parents', unit.parents.map(parent => parent.name).join(', '));
        const children = world.people.filter(child => child.parents?.some(parent => parent.id === unit.id));
        line('Family', unit.family_name || 'Founding household');
        line('Living / lifetime children', `${children.length} / ${unit.children_count || children.length}`);
        const culture = world.villages.find(v => v.id === unit.culture_id)?.culture;
        line('Culture', culture ? `${culture.name} · ${culture.value}` : 'Local traditions');
        if (unit.heritage_trait) line('Inherited aptitude', unit.heritage_trait);
        if (kingdom?.king_id === unit.id) line('Ruler personality', ruler_personality(unit));
        const routine = unit.daily_life;
        if (routine && unit.role !== 'soldier' && !unit.prisoner_of && !unit.voyage_id && !unit.medical_role && !unit.recovering) {
            line('Energy', `${Math.round(routine.energy)} / 100`);
            line('Carrying', `${routine.cargo.food.toFixed(1)} food · ${routine.cargo.wood.toFixed(1)} timber`);
            line('Delivered supplies', Math.floor(routine.delivered));
        }
        const relations = document.createElement('div'); relations.className = 'family-links';
        relations.setAttribute('aria-label', 'Family and relationships');
        const relative = (id, name, label) => {
            const living = world.people.find(person => person.id === id && person.health > 0);
            const link = document.createElement(living ? 'button' : 'span');
            link.textContent = `${label}: ${living?.name || name}${living ? '' : ' · remembered'}`;
            if (living) {
                link.dataset.action = `relative-${id}`;
                link.onclick = () => {
                    inspected_unit = { kind: 'person', id };
                    followed_unit_id = null; renderer.selected_unit_id = id;
                    renderer.focus(living.x, living.y, Math.max(6, renderer.zoom));
                    card.scrollTop = 0; update_zoom(); update_entity_card();
                };
            }
            relations.append(link);
        };
        if (unit.partner_id) relative(unit.partner_id,
            unit.relationships?.find(r => r.id === unit.partner_id)?.name || 'Former partner', 'Partner');
        for (const parent of unit.parents || []) relative(parent.id, parent.name, 'Parent');
        for (const child of children.slice(0, 8)) relative(child.id, child.name, 'Child');
        const family_ids = new Set([unit.partner_id, ...(unit.parents || []).map(p => p.id), ...children.map(p => p.id)]);
        for (const friend of (unit.relationships || []).filter(r => !family_ids.has(r.id) && r.affinity >= 10)
            .sort((a, b) => b.affinity - a.affinity).slice(0, 3)) {
            relative(friend.id, friend.name, `Bond ${Math.round(friend.affinity)}%`);
        }
        if (relations.childElementCount) card.append(relations);
    } else {
        line('Nature', unit.species === 'angel' ? 'Guardian · healing aura' : unit.species === 'demon'
            ? 'Hostile · spreads fire' : ['wolf', 'bear', 'fox', 'cat', 'hyena', 'owl'].includes(unit.species) ? 'Predator' : 'Wildlife');
    }
    if (unit.prisoner_of) {
        line('Held by', world.villages.find(v => v.id === unit.prisoner_of)?.name || 'Lost kingdom');
        line('Sentence', `${Math.ceil((unit.sentence || 0) / world.year_length)} years remaining`);
    }
    const actions = document.createElement('div'); actions.className = 'entity-actions';
    const zoom = document.createElement('button'); zoom.dataset.action = 'zoom-creature'; zoom.textContent = 'Zoom close';
    zoom.onclick = () => { renderer.focus(unit.x, unit.y, 12); update_zoom(); };
    const follow = document.createElement('button'); follow.dataset.action = 'follow-creature';
    follow.textContent = followed_unit_id === unit.id ? 'Stop following' : 'Follow';
    follow.onclick = () => {
        followed_unit_id = followed_unit_id === unit.id ? null : unit.id;
        if (followed_unit_id) { renderer.focus(unit.x, unit.y, 12); update_zoom(); }
        update_entity_card();
    };
    actions.append(zoom, follow); card.append(actions);
    card.scrollTop = scroll_top;
    follow.setAttribute('aria-pressed', String(followed_unit_id === unit.id));
    if (focused_action) card.querySelector(`[data-action="${focused_action}"]`)?.focus({ preventScroll: true });
}
let history_filter = 'all';
function event_row(event) {
    const located = Number.isFinite(event.x) && Number.isFinite(event.y);
    const row = document.createElement(located ? 'button' : 'div');
    row.className = `event history-event event-${event.kind}`;
    const when = document.createElement('small');
    when.textContent = `${event.kind === 'disaster' ? 'ϟ' : event.kind === 'village' ? '⚑' : '✦'} YEAR ${event.year}`;
    const text = document.createElement('p'); text.textContent = event.text;
    row.append(when, text);
    if (located) {
        const visit = document.createElement('span'); visit.className = 'event-visit'; visit.textContent = 'Visit location ↗'; row.append(visit);
        row.onclick = () => {
            followed_unit_id = null;
            renderer.focus(event.x, event.y, 4); update_zoom();
            if ($('history-dialog').open) $('history-dialog').close();
            document.body.classList.remove('info-open'); $('world-info').classList.remove('active');
            toast(`Year ${event.year} · ${event.text}`);
        };
    }
    return row;
}
function update_history() {
    const events = world.events.filter(event => history_filter === 'all' || event.kind === history_filter);
    $('history-count').textContent = `${events.length} events shown · keeps the latest 200 events · locations show the present-day world`;
    $('history-list').replaceChildren(...events.map(event_row));
    if (!events.length) {
        const empty = document.createElement('p'); empty.className = 'history-empty';
        empty.textContent = 'No events here yet. Let time run and watch a story begin.'; $('history-list').append(empty);
    }
}
$('open-history').onclick = () => { update_history(); $('history-dialog').showModal(); };
for (const button of document.querySelectorAll('[data-history]')) button.onclick = () => {
    history_filter = button.dataset.history;
    for (const other of document.querySelectorAll('[data-history]')) other.setAttribute('aria-pressed', String(other === button));
    update_history();
};
function update_diplomacy(preferred_source = null) {
    const alive = world.villages.filter(v => v.alive);
    const source_select = $('source-kingdom'), target_select = $('target-kingdom');
    const source_id = preferred_source ?? Number(source_select.value);
    const source = alive.find(v => v.id === source_id) || alive[0];
    const previous_target = Number(target_select.value);
    const target = alive.find(v => v.id === previous_target && v.id !== source?.id) || alive.find(v => v.id !== source?.id);
    const option = village => { const item = document.createElement('option'); item.value = village.id; item.textContent = village.name; return item; };
    source_select.replaceChildren(...alive.map(option));
    target_select.replaceChildren(...alive.filter(v => v.id !== source?.id).map(option));
    source_select.disabled = target_select.disabled = alive.length < 2;
    if (source) source_select.value = String(source.id);
    if (target) target_select.value = String(target.id);
    const status = source && target ? world.relation_status(source.id, target.id) : null;
    const profile = $('kingdom-profile'); profile.replaceChildren();
    if (source) {
        profile.style.setProperty('--kingdom-color', source.color);
        const colonies = world.colonies.filter(c => c.kingdom_id === source.id);
        const population = world.people.filter(p => p.village_id === source.id).length;
        const residents = world.people.filter(p => p.village_id === source.id);
        const soldiers = residents.filter(p => p.role === 'soldier').length;
        const alliances = alive.filter(v => v.id !== source.id && world.relation_status(v.id, source.id) === 'alliance').length;
        const wars = alive.filter(v => v.id !== source.id && world.relation_status(v.id, source.id) === 'war').length;
        const heading = document.createElement('strong'); heading.textContent = source.name; heading.style.setProperty('--kingdom-color', source.color);
        heading.prepend(kingdom_flag(source));
        const ruler = document.createElement('span'); ruler.textContent = `Ruler: ${world.people.find(p => p.id === source.king_id && p.health > 0)?.name || 'Awaiting succession'}`;
        const details = document.createElement('span'); details.textContent = `${population} people · ${soldiers} soldiers · ${colonies.length + 1} towns · founded year ${source.founded_year || 1}`;
        const technology = document.createElement('span');
        const level = technology_level(source);
        technology.className = 'technology-detail'; technology.style.setProperty('--technology-color', TECH_AGES[level].color);
        technology.textContent = `${TECH_AGES[level].name} · ${TECH_AGES[level].weapon} · gear improves damage and protection`;
        const research = document.createElement('span'); research.textContent = research_status(source);
        const ore = source.ore || {};
        const resources = document.createElement('span'); resources.textContent = `${Math.floor(source.food)} food · ${Math.floor(source.wood)} wood · Cu ${ore.copper || 0} · Sn ${ore.tin || 0} · Fe ${ore.iron || 0} · coal ${ore.coal || 0} · dust ${Math.floor(ore.stardust || 0)}`;
        const arsenal = document.createElement('span'); arsenal.textContent = `${source.weapons || 0} spare weapons · ${source.armor_stock || 0} spare armor · ${source.deaths || 0} deaths`;
        const jobs = document.createElement('span'); jobs.textContent = `${residents.filter(p => p.role !== 'soldier' && p.job === 'farmer').length} farmers · ${residents.filter(p => p.role !== 'soldier' && p.job === 'lumberjack').length} woodcutters · ${residents.filter(p => p.role !== 'soldier' && p.job === 'miner').length} miners · ${residents.filter(p => p.role !== 'soldier' && p.job === 'smith').length} smiths · ${residents.filter(p => p.role !== 'soldier' && p.job === 'builder').length} builders`;
        const logistics = document.createElement('span'); logistics.textContent = `${source.barracks ? 'Barracks active' : 'No barracks'} · ${world.trades.filter(t => t.from_id === source.id || t.to_id === source.id).length} trade routes underway`;
        const relations = document.createElement('span'); relations.textContent = `${alliances} alliances · ${wars} wars`;
        const armies = world.armies.filter(army => army.kingdom_id === source.id);
        const military = document.createElement('span');
        military.textContent = `${armies.length} garrisons · ${armies.filter(army => army.target_id).length} marching toward enemy towns`;
        profile.append(heading, ruler, details, technology, research, resources, arsenal, jobs, logistics, military, relations);
        if (colonies.length) {
            const towns = document.createElement('small'); towns.textContent = `Towns: ${colonies.map(c => c.name).join(', ')}`;
            profile.append(towns);
        }
    }
    $('relation-status').textContent = status === 'alliance' ? 'Allied kingdoms can send surplus supplies by caravan or ship.' : status === 'war' ? 'At war: trained soldiers attack and can capture towns by siege.' : status === 'peace' ? 'At peace: neighbouring kingdoms can send surplus supplies.' : 'Create at least two living kingdoms to manage relations.';
    for (const button of document.querySelectorAll('[data-relation]')) {
        button.disabled = !status || button.dataset.relation === status;
        button.classList.toggle('active', button.dataset.relation === status);
    }
}
$('diplomacy').onclick = () => {
    update_diplomacy(focused_village_id);
    $('law-diplomacy').checked = world.laws.diplomacy;
    $('law-expansion').checked = world.laws.expansion;
    $('law-rebellions').checked = world.laws.rebellions;
    $('diplomacy-dialog').showModal();
};
$('law-diplomacy').onchange = event => { world.laws.diplomacy = event.target.checked; toast(`Autonomous diplomacy ${event.target.checked ? 'enabled' : 'disabled'}.`); };
$('law-expansion').onchange = event => { world.laws.expansion = event.target.checked; toast(`Kingdom expansion ${event.target.checked ? 'enabled' : 'disabled'}.`); };
$('law-rebellions').onchange = event => { world.laws.rebellions = event.target.checked; toast(`Rebellions ${event.target.checked ? 'enabled' : 'disabled'}.`); };
$('source-kingdom').onchange = event => update_diplomacy(Number(event.currentTarget.value));
$('target-kingdom').onchange = () => update_diplomacy();
for (const button of document.querySelectorAll('[data-relation]')) button.onclick = () => {
    const source_id = Number($('source-kingdom').value), target_id = Number($('target-kingdom').value);
    if (world.set_relation(source_id, target_id, button.dataset.relation)) { update_diplomacy(source_id); update_ui(); }
};
function update_selected_kingdom() {
    const box = $('selected-kingdom');
    const kingdom = world.villages.find(v => v.id === focused_village_id && v.alive);
    box.hidden = !kingdom;
    if (!kingdom) { renderer.selected_kingdom_id = null; return; }
    renderer.selected_kingdom_id = kingdom.id;
    box.style.setProperty('--civ-color', kingdom.color);
    const residents = world.people.filter(p => p.village_id === kingdom.id);
    const soldiers = residents.filter(p => p.role === 'soldier');
    const towns = world.colonies.filter(c => c.kingdom_id === kingdom.id);
    const enemies = world.villages.filter(v => v.alive && world.relation_status(kingdom.id, v.id) === 'war');
    const allies = world.villages.filter(v => v.alive && world.relation_status(kingdom.id, v.id) === 'alliance');
    const armies = world.armies.filter(a => a.kingdom_id === kingdom.id && a.count >= 2);
    box.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = kingdom.name;
    heading.prepend(kingdom_flag(kingdom));
    const ruler = document.createElement('div'); ruler.textContent = `Ruler: ${world.people.find(p => p.id === kingdom.king_id && p.health > 0)?.name || 'Awaiting succession'}`;
    const culture = document.createElement('div');
    const leader = world.people.find(p => p.id === kingdom.king_id && p.health > 0);
    const social = society_modifiers(kingdom, leader);
    culture.className = 'kingdom-culture';
    culture.textContent = `Culture: ${kingdom.culture.name} (${kingdom.culture.value}) · ${social.personality} ruler`;
    const influence = document.createElement('div'); influence.className = 'culture-effects';
    const bonuses = [['research', social.research], ['production', social.production],
        ['training', social.training], ['recovery', social.healing]]
        .filter(([, value]) => value > 1).map(([label, value]) => `+${Math.round((value - 1) * 100)}% ${label}`);
    if (social.war_bias < 0) bonuses.push('favors alliances');
    if (social.war_bias > 0) bonuses.push('more willing to wage war');
    influence.textContent = bonuses.join(' · ') || 'Balanced policies';
    const status = document.createElement('span'); status.className = 'kingdom-status';
    status.textContent = enemies.length ? `⚔ At war with ${enemies.map(v => v.name).join(', ')}` : '☼ At peace';
    const stats = document.createElement('div'); stats.className = 'kingdom-quick-stats';
    stats.textContent = `${residents.length} people   ·   ${soldiers.length} soldiers   ·   ${towns.length + 1} towns`;
    const age = document.createElement('div'); age.textContent = `${TECH_AGES[technology_level(kingdom)].name} · ${TECH_AGES[technology_level(kingdom)].weapon}`;
    const stores = document.createElement('div'); stores.textContent = `Supplies: ${Math.floor(kingdom.food)} food · ${Math.floor(kingdom.wood)} wood`;
    const ore = kingdom.ore || {};
    const metals = document.createElement('div'); metals.textContent = `Ore: ${ore.copper || 0} copper · ${ore.tin || 0} tin · ${ore.iron || 0} iron · ${ore.coal || 0} coal · ${Math.floor(ore.stardust || 0)} stardust`;
    const settlements = document.createElement('div'); settlements.textContent = `Towns: Capital, ${towns.map(c => c.name).join(', ') || 'no colonies yet'}`;
    const march = document.createElement('div'); march.textContent = armies.length
        ? `Army: ${armies.map(a => `${a.count} ${a.target_name ? `marching to ${a.target_name}` : 'defending home'}`).join(' · ')}`
        : 'Army: no formed garrison yet';
    const diplomacy = document.createElement('div'); diplomacy.textContent = `Allies: ${allies.map(v => v.name).join(', ') || 'none'}`;
    const manage = document.createElement('button'); manage.textContent = 'Manage kingdom ↗';
    manage.onclick = () => $('diplomacy').click();
    const plan = document.createElement('div'); plan.textContent = `Strategy: ${kingdom.plan?.reason || 'Establish the settlement'}`;
    const care = document.createElement('div'); care.className = 'medical-summary';
    const clinics = (kingdom.buildings || []).filter(b => MEDICAL_BUILDINGS.has(b.type));
    const doctor_count = residents.filter(p => p.medical_role === 'doctor' && p.health > 0).length;
    const medicine = clinics.reduce((total, site) => total + (site.stock || 0), 0);
    care.textContent = clinics.length ? `Medical care: ${doctor_count} doctors · ${medicine.toFixed(1)} medicinal supplies · ${residents.filter(p => p.recovering).length} recovering · ${clinics.reduce((total, site) => total + (site.treatments || 0), 0)} treatments completed`
        : 'Medical care: no clinic yet · clinics need 8 residents, two homes and 12 timber (+10 reserve)';
    const building_counts = new Map();
    for (const b of kingdom.buildings || []) building_counts.set(b.type, (building_counts.get(b.type) || 0) + 1);
    const buildings = document.createElement('div'); buildings.textContent = `Buildings: ${[...building_counts].map(([type, count]) => `${BUILDINGS[type].label}${count > 1 ? ` ×${count}` : ''}`).join(', ') || 'homes and workshops'}`;
    const essentials = document.createElement('div'); essentials.className = 'basic-needs';
    essentials.textContent = `Basic needs: ${residents.length} residents · ${[kingdom, ...towns].reduce((sum, site) => sum + site.houses.length * 5, 0)} shelter places · ${building_counts.get('farm') || 0}/${farm_target(residents.length)} farms · Food reserve ${Math.floor(kingdom.food)}/${food_reserve(residents.length)} · ${Math.floor((kingdom.buildings || []).filter(b => b.type === 'granary').reduce((sum, b) => sum + (b.stock || 0), 0))} grain stored`;
    buildings.append(essentials);
    const research = document.createElement('div'); research.textContent = research_status(kingdom);
    const fleet = world.vehicles.filter(vehicle => vehicle.kingdom_id === kingdom.id);
    const transport = document.createElement('div'); transport.textContent = `Transport: ${fleet.length} vehicles · ${fleet.reduce((sum, vehicle) => sum + vehicle.deliveries, 0)} surplus deliveries`;
    const machines = world.machines.filter(machine => machine.kingdom_id === kingdom.id);
    const fleet_detail = document.createElement('div'); fleet_detail.textContent = `Fleet: ${machines.map(machine => `${MACHINES[machine.kind].label} (${machine.crew_aboard ? 'crewed' : machine.crew_id ? 'boarding' : 'awaiting crew'})`).join(', ') || 'no boats or aircraft yet'}`;
    const prisoners = world.people.filter(person => person.prisoner_of === kingdom.id);
    const release = document.createElement('button'); release.textContent = `Release prisoners (${prisoners.length})`;
    release.disabled = !prisoners.length;
    release.onclick = () => { for (const person of prisoners) person.sentence = 0; advance_detention(world, 0); update_ui(); };
    box.append(heading, ruler, culture, influence, status, stats, age, research, stores, metals, settlements, buildings, care, transport, fleet_detail, plan, march, diplomacy, manage, release);
}
function update_world_guidance(stats = world.stats()) {
    const progress = [stats.land > 0, stats.population > 0, world.time > 0.25];
    for (const [index, id] of ['guide-land', 'guide-people', 'guide-time'].entries()) {
        $(id).classList.toggle('complete', progress[index]);
        $(id).setAttribute('aria-label', `${progress[index] ? 'Complete: ' : ''}${$(id).querySelector('b').textContent}`);
    }
    $('guide-progress').textContent = `${progress.filter(Boolean).length}/3`;
    const guide = $('creation-guide');
    if (progress.every(Boolean) && guide.dataset.completed !== 'true') {
        guide.open = false; guide.dataset.completed = 'true';
    }
    const wars = world.relations.filter(relation => relation.status === 'war').length;
    let icon = paused ? 'Ⅱ' : '▶', kicker = paused ? 'SIMULATION PAUSED' : `RUNNING AT ${speed}×`, title, detail;
    if (!stats.land) {
        title = 'Begin by shaping land'; detail = 'Choose Land, then drag across the ocean.';
    } else if (!stats.population) {
        title = 'Your land is ready'; detail = 'Choose People and place settlers on the shore.';
    } else if (paused) {
        title = 'Ready when you are'; detail = `${stats.villages} ${stats.villages === 1 ? 'kingdom is' : 'kingdoms are'} waiting for time to resume.`;
    } else if (wars) {
        icon = '⚔'; kicker = `${wars} ACTIVE ${wars === 1 ? 'WAR' : 'WARS'}`; title = 'Conflict is reshaping the world'; detail = `${stats.soldiers} soldiers are serving across ${stats.villages} kingdoms.`;
    } else {
        icon = '✦'; title = 'The world is evolving'; detail = `${stats.population} people in ${stats.villages} ${stats.villages === 1 ? 'kingdom' : 'kingdoms'} · ${stats.wildlife} wildlife.`;
    }
    $('world-state-icon').textContent = icon;
    $('world-state-kicker').textContent = kicker;
    $('world-state-title').textContent = title;
    $('world-state-detail').textContent = detail;
}
function update_ui() {
    update_entity_card();
    const minutes = Math.floor(world.lighting.phase * 1440) % 1440;
    $('lighting').textContent = `${minutes < 360 || minutes > 1080 ? '☾' : '☀'} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const stats = world.stats();
    update_world_guidance(stats);
    for (const id of ['population', 'soldiers', 'wildlife', 'villages', 'towns', 'trees']) $(id).textContent = stats[id].toLocaleString();
    $('civ-count').textContent = stats.villages; $('land-percent').textContent = `${stats.land}% land`;
    $('survival').hidden = world.scenario !== 'hundred';
    const founders = world.villages.slice(0, 100).filter(v => v.alive).length;
    $('survival').textContent = `${founders} of 100 founding kingdoms survive · ${Math.min(world.year, 1000)} / 1,000 years`;
    $('world-name').textContent = world.name; $('world-type').textContent = world.scenario === 'hundred' ? '100 KINGDOMS' : 'SANDBOX'; $('year').textContent = world.year;
    const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    $('season').textContent = `${seasons[Math.floor(world.time / 5) % 4]} · Year ${world.year}`;
    const living_kingdoms = world.villages.filter(v => v.alive);
    const average_technology = living_kingdoms.length ? living_kingdoms.reduce((sum, v) => {
        const level = technology_level(v), next = TECH_AGES[level + 1];
        const fraction = next ? Math.min(0.95, Math.max(0, ((v.tech_points || 0) - TECH_AGES[level].threshold) / (next.threshold - TECH_AGES[level].threshold))) : 0;
        return sum + level + fraction;
    }, 0) / living_kingdoms.length : 0;
    const age_level = Math.floor(average_technology);
    const age = TECH_AGES[age_level], next_age = TECH_AGES[age_level + 1];
    const progress = next_age ? average_technology - age_level : 1;
    $('age-label').textContent = age.name.toUpperCase();
    $('era').textContent = `${age.name} · ${age.weapon.toLowerCase()}s`;
    $('age-progress').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
    document.querySelector('.map-label').style.setProperty('--age-color', age.color);
    const visible_age = Math.max(0, Math.min(TECH_AGES.length - 5, age_level - 2));
    for (const [index, step] of [...document.querySelectorAll('.age-stages span')].entries()) {
        step.hidden = index < visible_age || index >= visible_age + 5;
        step.classList.toggle('active', index === age_level);
        step.classList.toggle('reached', index < age_level);
    }
    $('civilizations').replaceChildren();
    const populations = new Map();
    for (const person of world.people) populations.set(person.village_id, (populations.get(person.village_id) || 0) + 1);
    const warring = new Set();
    for (const relation of world.relations) if (relation.status === 'war') {
        warring.add(relation.a); warring.add(relation.b);
    }
    const living = world.villages.filter(v => v.alive);
    if (world.scenario === 'hundred') living.sort((a, b) => (populations.get(b.id) || 0) - (populations.get(a.id) || 0));
    for (const v of living) {
        const pop = populations.get(v.id) || 0;
        const button = document.createElement('button'); button.className = 'civilization'; button.title = `Visit ${v.name}`;
        button.classList.toggle('active', focused_village_id === v.id);
        button.style.setProperty('--civ-color', v.color);
        const dot = kingdom_flag(v);
        const name = document.createElement('span'); name.className = 'civ-name'; name.textContent = v.name;
        const towns = world.colonies.filter(c => c.kingdom_id === v.id).length + 1;
        const small = document.createElement('small'); small.textContent = `${towns} ${towns === 1 ? 'town' : 'towns'} · ${TECH_AGES[technology_level(v)].name}${warring.has(v.id) ? ' · ⚔ at war' : ''}`; name.append(small);
        const count = document.createElement('span'); count.className = 'civ-pop'; count.textContent = `${pop} ♟`;
        button.append(dot, name, count); button.onclick = () => {
            focused_village_id = v.id; followed_unit_id = null; renderer.focus(v.x, v.y); update_zoom(); update_ui();
            $('selected-kingdom').scrollIntoView({ block: 'nearest' });
        };
        $('civilizations').append(button);
    }
    if (!stats.villages) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Place people on land to begin a civilization.'; $('civilizations').append(p); }
    update_selected_kingdom();
    const signature = JSON.stringify(world.events);
    if ($('chronicle').dataset.signature !== signature) {
        $('chronicle').dataset.signature = signature; $('chronicle').replaceChildren();
        $('chronicle').append(...world.events.slice(0, 6).map(event_row));
        if ($('history-dialog').open) update_history();
    }
}
function replace_world(next) {
    $('creation-guide').dataset.completed = 'false';
    $('creation-guide').open = true;
    world = next; focused_village_id = null; inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; renderer.selected_kingdom_id = null;
    renderer.last_revision = -1; renderer.territory_last = -Infinity; renderer.fit(); renderer.pointer = null;
    end_pointer(); update_zoom(); update_ui(); set_pause(false); $('world-tooltip').hidden = true;
}
const terrain_colors = ['#173e53', '#4e8f9b', '#d9c998', '#8cb873', '#537c59', '#89946b', '#a3aaa3', '#df8055', '#635f54', '#52b87b', '#d5bd65', '#c4e7e7', '#e98d7a', '#ab83cb', '#75d2d5', '#cba7ed', '#e4b567'];
let preview_timer;
function refresh_preview() {
    const form = $('new-form');
    const preset = $('scenario').value === 'hundred' ? 'fractured' : $('preset').value;
    const preview = new World({ seed: form.elements.seed.value, preset, inhabited: false });
    const canvas = $('map-preview'), context = canvas.getContext('2d');
    const image = context.createImageData(WIDTH, HEIGHT);
    let land = 0;
    for (let i = 0; i < preview.tiles.length; i++) {
        const tile = preview.tiles[i], color = terrain_colors[tile];
        if (tile > T.SHALLOW) land++;
        image.data[i * 4] = parseInt(color.slice(1, 3), 16);
        image.data[i * 4 + 1] = parseInt(color.slice(3, 5), 16);
        image.data[i * 4 + 2] = parseInt(color.slice(5, 7), 16);
        image.data[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    $('preview-summary').textContent = `${Math.round(land / preview.tiles.length * 100)}% land · ${WIDTH} × ${HEIGHT} tiles · seed ${form.elements.seed.value}`;
}
function schedule_preview() { clearTimeout(preview_timer); preview_timer = setTimeout(refresh_preview, 100); }
function fresh_seed() { return Math.random().toString(36).slice(2, 10); }
function open_world_setup() {
    if (!$('new-form').elements.seed.value) $('new-form').elements.seed.value = fresh_seed();
    refresh_preview(); $('new-dialog').showModal();
}
function show_start_ready() {
    world_started = true;
    set_pause(true);
    $('start-home').hidden = true; $('start-ready').hidden = false;
    $('start-message').textContent = `${world.name} is ready. Paint the map while paused, or start time when you choose.`;
    $('start-detail').textContent = `${world.stats().land}% land · ${world.stats().villages} kingdoms · ${world.scenario === 'hundred' ? '100-kingdom challenge' : 'living sandbox'}`;
    $('start-screen').hidden = false;
}
function close_start() { $('start-screen').hidden = true; set_pause(false); }
function show_start_home() {
    set_pause(true);
    document.body.classList.remove('info-open'); $('world-info').classList.remove('active');
    $('start-home').hidden = false; $('start-ready').hidden = true;
    $('menu-resume').hidden = !world_started;
    let saved = false;
    try { saved = Boolean(localStorage.getItem(storage_key)); } catch { /* Storage may be unavailable. */ }
    $('menu-continue').disabled = !saved;
    $('start-message').textContent = 'Choose a landscape, set the rules, and begin your world.';
    $('start-detail').textContent = 'Build it from empty ocean or choose a generated map.';
    $('start-screen').hidden = false;
}
$('menu').onclick = show_start_home;
$('world-info').onclick = () => {
    const open = !document.body.classList.contains('info-open');
    document.body.classList.toggle('info-open', open); $('world-info').classList.toggle('active', open);
};
$('close-world-info').onclick = () => { document.body.classList.remove('info-open'); $('world-info').classList.remove('active'); };
$('menu-create').onclick = $('menu-edit').onclick = $('new-world').onclick = open_world_setup;
$('menu-resume').onclick = close_start;
$('menu-start').onclick = close_start;
$('menu-paint').onclick = () => { $('start-screen').hidden = true; set_pause(true); };
$('menu-continue').onclick = () => {
    try { replace_world(World.deserialize(JSON.parse(localStorage.getItem(storage_key)).world)); show_start_ready(); }
    catch { toast('That save could not be loaded. Your current world is safe.'); }
};
$('menu-load').onclick = () => $('load').click();
$('regenerate-seed').onclick = () => { $('new-form').elements.seed.value = fresh_seed(); refresh_preview(); };
$('new-form').elements.seed.oninput = schedule_preview;
$('preset').onchange = schedule_preview;
$('scenario').onchange = () => {
    const challenge = $('scenario').value === 'hundred';
    $('scenario-note').hidden = !challenge;
    if (challenge) {
        $('preset').value = 'fractured'; $('inhabited').checked = true;
        $('new-form').elements.diplomacy.checked = true;
        $('new-form').elements.expansion.checked = true;
    }
    $('preset').disabled = $('inhabited').disabled = challenge;
    schedule_preview();
};
$('help').onclick = () => $('help-dialog').showModal();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => button.closest('dialog').close();
$('new-form').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim() || 'An Unwritten World';
    const seed = String(data.get('seed')).trim();
    const next = new World({ name, seed, preset: $('preset').value, inhabited: data.has('inhabited'), scenario: $('scenario').value });
    next.laws = { diplomacy: data.has('diplomacy'), expansion: data.has('expansion'), rebellions: data.has('rebellions') };
    replace_world(next);
    $('new-dialog').close(); show_start_ready(); toast('Your world is ready. Start time whenever you like.');
};
$('save').onclick = () => {
    try {
        localStorage.setItem(storage_key, JSON.stringify({ saved_at: new Date().toISOString(), world: world.serialize() }));
        toast('World saved on this device.');
    } catch { toast('Device storage is unavailable. Use Load → Export to save a file.'); }
};
$('load').onclick = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(storage_key) || 'null');
        if (saved) {
            const checked = World.deserialize(saved.world);
            $('saved-world').textContent = `${checked.name} · Year ${checked.year} · ${checked.people.length} people · saved ${new Date(saved.saved_at).toLocaleString()}`;
        } else $('saved-world').textContent = 'No device save yet. You can import a world file below.';
        $('restore').disabled = !saved;
    } catch { $('saved-world').textContent = 'The device save could not be read. Import a world file instead.'; $('restore').disabled = true; }
    $('load-dialog').showModal();
};
$('restore').onclick = () => {
    try {
        replace_world(World.deserialize(JSON.parse(localStorage.getItem(storage_key)).world));
        $('load-dialog').close(); if (!$('start-screen').hidden) show_start_ready();
        toast('Welcome back to your world.');
    }
    catch { toast('That save could not be loaded. Your current world is safe.'); }
};
$('export').onclick = () => {
    const blob = new Blob([JSON.stringify(world.serialize())], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url;
    a.download = `${world.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'world'}-year-${world.year}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); toast('World file exported. Keep it for your next adventure.');
};
$('import').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
        if (file.size > 8_000_000) throw new Error('World files must be smaller than 8 MB.');
        const next = World.deserialize(JSON.parse(await file.text()));
        replace_world(next); $('load-dialog').close(); if (!$('start-screen').hidden) show_start_ready();
        toast('Your world has arrived.');
    } catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message); }
    event.target.value = '';
};
window.addEventListener('keydown', event => {
    if (!$('start-screen').hidden || document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('save').click(); return; }
    if (event.metaKey || event.ctrlKey) return;
    if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) set_pause(!paused); }
    if (['1', '2', '3', '4'].includes(event.key)) { set_speed({ 1: 1, 2: 2, 3: 5, 4: 20 }[event.key]); set_pause(false); }
    if (event.key.toLowerCase() === 'i') select_tool(tool === 'inspect' ? previous_tool : 'inspect');
    if (event.key === 'Escape') select_tool(previous_tool);
    if (event.key === '+' || event.key === '=') renderer.zoom_at(1.2);
    if (event.key === '-') renderer.zoom_at(1 / 1.2);
    if (['[', ']'].includes(event.key)) { $('brush').value = Math.max(1, Math.min(12, brush + (event.key === ']' ? 1 : -1))); $('brush').oninput(); }
    const movement = { a: [45, 0], d: [-45, 0], w: [0, 45], s: [0, -45] }[event.key.toLowerCase()];
    if (movement) { followed_unit_id = null; renderer.pan_x += movement[0]; renderer.pan_y += movement[1]; }
    update_zoom();
});
async function toggle_sound() {
    try {
        if (!audio_context) {
            audio_context = new AudioContext(); audio_gain = audio_context.createGain(); audio_gain.gain.value = 0; audio_gain.connect(audio_context.destination);
            for (const [i, frequency] of [130.81, 196, 261.63, 329.63].entries()) {
                const oscillator = audio_context.createOscillator(), gain = audio_context.createGain();
                oscillator.type = 'sine'; oscillator.frequency.value = frequency;
                gain.gain.value = 0.06 / (i + 1); oscillator.connect(gain); gain.connect(audio_gain); oscillator.start();
                const lfo = audio_context.createOscillator(), depth = audio_context.createGain(); lfo.frequency.value = 0.08 + i * 0.023; depth.gain.value = 0.018 / (i + 1); lfo.connect(depth); depth.connect(gain.gain); lfo.start();
            }
        }
        await audio_context.resume(); sound_on = !sound_on;
        audio_gain.gain.setTargetAtTime(sound_on ? 0.3 : 0, audio_context.currentTime, 0.6);
        $('sound').textContent = sound_on ? '♫ Sound on' : '♫ Sound off';
    } catch { toast('Sound is unavailable in this browser.'); }
}
function power_sound(type) {
    if (!sound_on || !audio_context) return;
    const oscillator = audio_context.createOscillator(), gain = audio_context.createGain(), time = audio_context.currentTime;
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(type === 'meteor' ? 100 : 260, time); oscillator.frequency.exponentialRampToValueAtTime(25, time + 0.35);
    gain.gain.setValueAtTime(0.15, time); gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    oscillator.connect(gain); gain.connect(audio_gain); oscillator.start(); oscillator.stop(time + 0.5);
}
$('sound').onclick = toggle_sound;
$('lighting').onclick = () => {
    $('day-length').value = String(world.lighting.cycle_seconds);
    $('lighting-dialog').showModal();
};
$('day-length').onchange = () => {
    world.lighting.cycle_seconds = Number($('day-length').value);
    if (world.lighting.cycle_seconds === 86400) {
        const now = new Date();
        world.lighting.phase = (now.getHours() * 60 + now.getMinutes()) / 1440;
    }
};
for (const button of document.querySelectorAll('[data-day-phase]')) button.onclick = () => {
    world.lighting.phase = Number(button.dataset.dayPhase); update_ui();
};
let last_frame = performance.now(), accumulator = 0, ui_elapsed = 0;
function frame(now) {
    const dt = Math.min((now - last_frame) / 1000, 0.1); last_frame = now;
    const dialog_open = Boolean(document.querySelector('dialog[open]'));
    if (!document.hidden && !dialog_open && $('start-screen').hidden) {
        if (!paused) {
            advance_daylight(world.lighting, dt, speed);
            accumulator += dt * speed;
            let steps = 0;
            while (accumulator >= 0.125 && steps < 16) { world.step(0.125); accumulator -= 0.125; steps++; }
            accumulator = Math.min(accumulator, 2);
        }
        if (pointer_down && last_pointer) { paint_elapsed += dt; if (paint_elapsed > 0.085) { paint(last_pointer, true); paint_elapsed = 0; } }
    }
    if (followed_unit_id) {
        const unit = world.people.find(p => p.id === followed_unit_id) || world.animals.find(a => a.id === followed_unit_id);
        if (unit) renderer.center_on(unit.x, unit.y); else followed_unit_id = null;
    }
    renderer.render(world, now);
    ui_elapsed += dt;
    if (ui_elapsed > 0.5) { update_ui(); ui_elapsed = 0; }
    requestAnimationFrame(frame);
}
show_tools(); update_ui(); show_start_home(); requestAnimationFrame(frame);
// A narrow, read-only diagnostic hook for the desktop smoke test.
window.genesis = Object.freeze({ snapshot: () => world.serialize(), stats: () => world.stats(), camera: () => ({ width: renderer.width, height: renderer.height, base: renderer.base, zoom: renderer.zoom, origin: renderer.origin }) });
