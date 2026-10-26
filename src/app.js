import { FORESTRY, is_tree_site } from './forestry.js';
import { MAP_LAYERS, layer_summary } from './map_layers.js';
import { army_summary, rebuild_armies } from './army_inspector.js';
import { ship_summary, ship_position } from './ship_inspector.js';
import { create_save_ui } from './save_ui.js';
import { WEATHER } from './weather.js';
import { World, WIDTH, HEIGHT, T, TERRAIN_NAMES, TECH_AGES, RESEARCH_COSTS, RESEARCH_BUILDINGS, RACES, ANIMALS, technology_level } from './simulation.js';
import { Renderer } from './renderer.js';
import { MIN_ZOOM, MAX_ZOOM } from './camera.js';
import { TouchCamera } from './touch_camera.js';
import { GameAudio, tool_sound } from './game_audio.js';
import { bind_audio_ui } from './audio_ui.js';
import { creature_stats } from './creatures.js';
import { BUILDINGS } from './settlements.js';
import { advance_daylight } from './daylight.js';
import { VEHICLES } from './infrastructure.js';
import { draw_flag, royal_successors } from './heraldry.js';
import { MACHINES } from './machines.js';
import { CIVIC_DESCRIPTIONS, farm_target, food_reserve } from './civic.js';
import { advance_detention } from './defenses.js';
import { draw_tree } from './world_art.js';
import { ruler_personality, society_modifiers } from './society.js';
import { DAMAGE_CAUSES, health_risks } from './health.js';
import { MEDICAL_BUILDINGS } from './medicine.js';
import { bind_character_ui } from './character_ui.js';
import { life_stage } from './needs.js';
import { DIET_CATALOG } from './diets.js';
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
        ['fire', 'Fire', '♨', '#e3a16a', 'Spark a local wildfire. Flames spread up to six tiles beyond the ignited patch.'],
        ['lightning', 'Lightning', 'ϟ', '#eee1a3', 'Strike a small area with thunder. Nearby vegetation can catch a local fire.'],
        ['meteor', 'Meteor', '☄', '#e7a288', 'Bring down a star. Leave a crater of ash and molten rock.'],
        ['nuke', 'Nuclear bomb', '☢', '#d99175', 'A devastating blast that scorches a wide crater and sets the land ablaze.'],
        ['plague', 'Plague', '☣', '#a4bd83', 'Infect nearby creatures. The sickness spreads until they recover or perish.'],
        ['acid', 'Acid rain', '♨', '#a3c77c', 'A caustic storm that poisons the soil and harms creatures.'],
        ['bless', 'Blessing', '✦', '#e1e9a4', 'A gentler touch. Restore health and fertility to a patch of the world.'],
        ['erase', 'Remove life', '◇', '#c2aaa0', 'Make room for another beginning. Remove creatures and buildings.']
    ]
};
TOOLS.nature = [
    ['raincloud', 'Rain cloud', '☂', '#9ecde0', 'A drifting rain cloud quenches fires and restores soil for 24 simulation seconds.'],
    ['storm', 'Thunderstorm', 'ϟ', '#89afc4', 'A moving storm brings heavy rain and repeated lightning strikes.'],
    ['lightning', 'Lightning', 'ϟ', '#eee1a3', 'Strike a small area once. Fire can spread up to six tiles beyond the ignited patch.'],
    ['tsunami', 'Tsunami', '≈', '#9edddc', 'Start one wave in deep ocean near a coast. It damages low coastal land; high ground blocks it. Wait for it to recede before placing another.'],
    ['drought', 'Drought', '☀', '#e2c26b', 'Dry the soil and damage crop growth for 30 simulation seconds.'],
    ['blizzard', 'Blizzard', '❄', '#cfe8eb', 'A drifting snowstorm damages crops and exposed life. Nearby homes reduce cold damage.'],
    ['fire', 'Wildfire', '♨', '#e3a16a', 'Ignite a local patch. Fire spreads up to six tiles farther; water and snow stop it, and rain quenches it.']
];
TOOLS.plants = TOOLS.terrain.filter(item => ['forest', 'jungle', 'maple', 'mushroom', 'celestial'].includes(item[0]));
const CATALOG_INFO = {
    nature: 'Nature · place a weather event; it develops while time runs',
    terrain: 'Shape the landscape · drag to paint',
    life: 'Civilizations · each click places three settlers on land',
    creatures: 'Wildlife & mythical beings · click land to place one',
    plants: 'Living biomes · paint woodland for food and timber',
    powers: 'World powers · choose a tool, then use it on the map'
};
const LIFE_TOOLS = new Set([...Object.keys(RACES), ...ANIMALS]);
let world = new World({ preset: 'empty', inhabited: false });
const renderer = new Renderer($('world'), $('minimap'));
let category = 'terrain', tool = 'inspect', previous_tool = 'inspect', brush = 4, paused = false, speed = 1;
let focused_village_id = null;
let inspected_unit = null;
let followed_unit_id = null;
let inspect_start = null;
let pointer_down = false, panning = false, last_pointer = null, paint_elapsed = 0, last_paint = null;
let toast_timer, zoom_voice_timer, tool_voice_timer;
const audio = new GameAudio();
const saves = create_save_ui({
    get_world: () => world, is_started: () => world_started, replace: replace_world,
    after_load: () => { if (!$('start-screen').hidden) show_start_ready(); },
    pause: set_pause, is_paused: () => paused, notify: toast,
    feedback: (kind, text) => audio.feedback(kind, text)
});
let world_started = false;
function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toast_timer); toast_timer = setTimeout(() => { $('toast').hidden = true; }, 3300);
    audio.feedback(/^Saved /.test(message) ? 'save' : /^Restored/.test(message) ? 'load' : 'ui', message,
        { key: 'notice', interval: 500 });
}
const character_editor = bind_character_ui({
    get_world: () => world, get_selection: () => inspected_unit,
    on_change: () => update_ui(), notify: toast
});
// Keep the map clear until the player explicitly chooses a creator tool.
$('sandbox-dock').append(document.querySelector('.tabs'));
document.querySelector('.tool-panel').append(document.querySelector('.tool-description'), document.querySelector('.brush-section'));
$('toggle-controls').hidden = true;
$('map-view-controls').append(document.querySelector('.zoom-controls'), $('lighting'));
$('weather-summary').onclick = () => document.querySelector('[data-category="nature"]').click();
$('observe').onclick = () => {
    inspected_unit = null; followed_unit_id = null; focused_village_id = null;
    renderer.selected_unit_id = null; renderer.selected_kingdom_id = null;
    $('entity-card').hidden = true;
    document.body.classList.remove('info-open', 'kingdom-inspecting');
    select_tool('inspect');
};
function inspector_details(container, children, title, key) {
    const details = document.createElement('details'); details.className = 'inspector-details';
    details.dataset.detail = key;
    const summary = document.createElement('summary'); summary.textContent = title;
    details.append(summary, ...children); container.append(details);
    return details;
}
function select_tool(id) {
    tool = id; renderer.tool = id; renderer.brush = id === 'lightning' ? 2 : brush; end_pointer();
    $('observe').setAttribute('aria-pressed', String(id === 'inspect'));
    document.body.classList.toggle('catalog-open', id !== 'inspect');
    if (id === 'inspect') document.body.classList.add('controls-collapsed');
    document.body.classList.toggle('inspecting', id === 'inspect');
    if (id !== 'inspect') { inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; }
    $('inspect').classList.toggle('active', id === 'inspect');
    $('world-tooltip').hidden = true;
    if (id === 'inspect') {
        $('selected-icon').textContent = '⌕'; $('selected-name').textContent = 'Inspect world';
        $('selected-description').textContent = 'Click a person, animal, ship or army banner for its profile. Armies layer reveals home garrisons.';
        $('selected-action').textContent = 'CLICK LIFE, A SHIP OR AN ARMY BANNER';
    } else {
        previous_tool = id;
        const item = Object.values(TOOLS).flat().find(t => t[0] === id);
        $('selected-icon').textContent = item[2]; $('selected-name').textContent = item[1]; $('selected-description').textContent = item[4];
        $('selected-action').textContent = id === 'lightning' ? 'CLICK ONCE TO STRIKE' : LIFE_TOOLS.has(id) ? 'CLICK WALKABLE LAND TO PLACE' : 'DRAG ON THE MAP TO APPLY';
    }
    const tool_name = $('selected-name').textContent;
    const instruction = id === 'inspect' ? 'Click a creature for details' : id === 'lightning' ? 'Click once to strike' : LIFE_TOOLS.has(id) ? 'Click land to place' : 'Drag on the map to apply';
    $('interaction-hint').replaceChildren();
    const hint_name = document.createElement('b'); hint_name.textContent = `${tool_name} selected`;
    const hint_action = document.createElement('span'); hint_action.textContent = `${instruction} · right-drag to move · scroll or pinch to zoom`;
    $('interaction-hint').append(hint_name, hint_action);
    $('footer-status').replaceChildren();
    const footer_icon = document.createElement('span'); footer_icon.textContent = $('selected-icon').textContent;
    $('footer-status').append(footer_icon, `${tool_name} · ${instruction.toLowerCase()}`);
    $('brush').closest('.brush-section').hidden = id === 'inspect' || id === 'lightning' || LIFE_TOOLS.has(id);
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
    for (const button of $('tools').children) button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
}
for (const tab of document.querySelectorAll('[data-category]')) tab.onclick = () => {
    const already_open = category === tab.dataset.category && document.body.classList.contains('catalog-open');
    category = tab.dataset.category;
    for (const other of document.querySelectorAll('[data-category]')) other.setAttribute('aria-selected', String(other === tab));
    show_tools();
    if (already_open) select_tool('inspect');
    else select_tool(TOOLS[category].some(t => t[0] === tool) ? tool : TOOLS[category][0][0]);
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
$('brush').oninput = () => { brush = Number($('brush').value); renderer.brush = tool === 'lightning' ? 2 : brush; $('brush-value').textContent = `${brush} ${brush === 1 ? 'tile' : 'tiles'}`; };
function set_pause(value) {
    if (world_started && paused !== value) audio.feedback(value ? 'pause' : 'resume', value ? 'Time paused' : 'Time running');
    paused = value; $('pause').textContent = paused ? '▶ Resume' : 'Ⅱ Pause'; $('pause').setAttribute('aria-label', paused ? 'Resume time' : 'Pause time'); $('paused-banner').hidden = !paused;
    update_world_guidance();
}
$('pause').onclick = () => set_pause(!paused);
function set_speed(value) {
    speed = value;
    audio.feedback('resume', `Time speed ${value} times`, { key: 'speed', interval: 150 });
    for (const button of document.querySelectorAll('[data-speed]')) button.classList.toggle('active', Number(button.dataset.speed) === speed);
}
for (const button of document.querySelectorAll('[data-speed]')) button.onclick = () => { set_speed(Number(button.dataset.speed)); set_pause(false); };
function zoom_slider_value(zoom) { return Math.round(Math.log(zoom / MIN_ZOOM) / Math.log(MAX_ZOOM / MIN_ZOOM) * 100); }
function update_zoom() {
    $('zoom-reset').textContent = `${Math.round(renderer.zoom * 100)}%`;
    $('zoom-slider').value = String(zoom_slider_value(renderer.zoom));
}
$('zoom-slider').oninput = () => {
    end_pointer(); followed_unit_id = null;
    const zoom = MIN_ZOOM * (MAX_ZOOM / MIN_ZOOM) ** (Number($('zoom-slider').value) / 100);
    renderer.stop_motion(); renderer.zoom_at(zoom / renderer.zoom, undefined, undefined, true); update_zoom();
    zoom_feedback();
};
function zoom_feedback() {
    audio.play('zoom', { interval: 110 });
    clearTimeout(zoom_voice_timer);
    zoom_voice_timer = setTimeout(() => audio.speak(`Zoom ${Math.round(renderer.zoom_goal * 100)} percent`,
        { key: 'camera', interval: 800 }), 220);
}
function manual_zoom(multiplier, x, y) {
    end_pointer(); followed_unit_id = null; renderer.pointer = null;
    renderer.zoom_at(multiplier, x, y); update_zoom();
    zoom_feedback();
}
$('zoom-in').onclick = () => manual_zoom(1.15);
$('zoom-out').onclick = () => manual_zoom(1 / 1.15);
$('zoom-reset').onclick = $('fit').onclick = () => {
    end_pointer(); followed_unit_id = null; renderer.fit(); update_zoom();
    clearTimeout(zoom_voice_timer); audio.feedback('zoom', 'Whole world view');
};
$('borders').onclick = () => { renderer.borders = !renderer.borders; $('borders').classList.toggle('active', renderer.borders); };
$('inspect').onclick = () => $('observe').click();
for (const option of document.querySelectorAll('[name="map-layer"]')) option.onchange = () => {
    renderer.layer = option.value; renderer.borders = option.value !== 'terrain' && option.value !== 'resources';
    $('borders').classList.toggle('active', renderer.borders);
    $('map-layers').open = false;
    $('map-layers').querySelector('summary').textContent = MAP_LAYERS[option.value];
    $('map-layers').querySelector('summary').focus();
    update_ui();
};
function set_presentation(active) {
    document.body.classList.toggle('presentation', active);
    $('presentation').setAttribute('aria-pressed', String(active));
    $('exit-presentation').hidden = !active;
    $('map-layers').open = false;
    if (active) { select_tool('inspect'); $('exit-presentation').focus(); }
    else $('presentation').focus();
}
$('presentation').onclick = () => set_presentation(true);
$('exit-presentation').onclick = () => set_presentation(false);
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
    paint_tile(renderer.world_point(p.x, p.y), continuous);
}
function paint_tile(tile, continuous = false) {
    if (tool === 'inspect') return;
    if (continuous && (['meteor', 'nuke', 'lightning', ...Object.keys(WEATHER)].includes(tool) || LIFE_TOOLS.has(tool))) return;
    if (!world.inside(tile.x, tile.y)) return;
    if (LIFE_TOOLS.has(tool) && !world.walkable(tile.x, tile.y)) { toast('Place life on walkable land.'); return; }
    if (last_paint && !['meteor', 'nuke', 'lightning', 'rain', 'bless', ...Object.keys(WEATHER)].includes(tool) && !LIFE_TOOLS.has(tool)) {
        const distance = Math.hypot(tile.x - last_paint.x, tile.y - last_paint.y);
        const steps = Math.min(100, Math.ceil(distance / Math.max(1, brush / 2)));
        for (let i = 1; i < steps; i++) world.apply(tool, last_paint.x + (tile.x - last_paint.x) * i / steps, last_paint.y + (tile.y - last_paint.y) * i / steps, brush);
    }
    const before_life = LIFE_TOOLS.has(tool) ? world.people.length + world.animals.length : 0;
    const outcome = world.apply(tool, tile.x, tile.y, brush); last_paint = tile;
    if (outcome?.message) toast(outcome.message);
    if (LIFE_TOOLS.has(tool)) {
        const placed = world.people.length + world.animals.length - before_life;
        toast(placed ? `${placed} ${RACES[tool] ? 'settlers' : 'creature'} placed. Choose Inspect to follow their story.` : 'No life placed. This world may have reached its population limit.');
    }
    if (outcome?.ok !== false) {
        const screen_x = renderer.origin.x + tile.x * 6 * renderer.scale;
        audio.play(tool_sound(tool), { key: 'brush', interval: 140, pan: screen_x / renderer.width * 2 - 1 });
        clearTimeout(tool_voice_timer);
        const name = $('selected-name').textContent;
        tool_voice_timer = setTimeout(() => audio.speak(`${name} applied`, { key: 'brush', interval: 1800 }), 180);
    }
}
const canvas = $('world');
const touch_camera = new TouchCamera(renderer, {
    inspect: point => inspect_click(point),
    paint: points => {
        last_paint = null;
        for (const [index, point] of points.entries()) paint_tile(point, index > 0);
        last_paint = null;
    }
});
const motion_preference = matchMedia('(prefers-reduced-motion: reduce)');
renderer.reduced_motion = motion_preference.matches;
motion_preference.addEventListener('change', event => {
    renderer.reduced_motion = event.matches;
    if (event.matches) renderer.finish_motion();
});
canvas.oncontextmenu = event => event.preventDefault();
canvas.onpointerdown = event => {
    if (event.pointerType === 'touch') {
        pointer_down = false; panning = false; inspect_start = null; last_paint = null;
        event.preventDefault(); followed_unit_id = null; renderer.pointer = null;
        $('world-tooltip').hidden = true; canvas.setPointerCapture(event.pointerId);
        touch_camera.down(event.pointerId, local_point(event), tool !== 'inspect'); return;
    }
    if (![0, 1, 2].includes(event.button)) return;
    renderer.stop_motion();
    const p = local_point(event); last_pointer = p; renderer.pointer = p;
    if (event.button === 0 && !event.altKey && tool === 'inspect') {
        inspect_start = p; canvas.setPointerCapture(event.pointerId); return;
    }
    panning = event.button !== 0 || event.altKey;
    pointer_down = !panning; last_paint = null; paint_elapsed = 0;
    canvas.setPointerCapture(event.pointerId);
    if (pointer_down) paint(p);
    if (panning) { followed_unit_id = null; canvas.style.cursor = 'grabbing'; }
};
canvas.onpointermove = event => {
    if (event.pointerType === 'touch') {
        event.preventDefault(); touch_camera.move(event.pointerId, local_point(event)); return;
    }
    const p = local_point(event);
    if (inspect_start && Math.hypot(p.x - inspect_start.x, p.y - inspect_start.y) > 4) { panning = true; inspect_start = null; followed_unit_id = null; }
    if (panning && last_pointer) renderer.pan_by(p.x - last_pointer.x, p.y - last_pointer.y);
    last_pointer = p; renderer.pointer = p;
    if (tool === 'inspect') inspect(p);
};
function end_pointer(event) {
    if (event?.pointerType === 'touch') {
        const gesture_finished = touch_camera.gesture && touch_camera.points.size === 1;
        if (event.type === 'pointerup') touch_camera.up(event.pointerId, local_point(event));
        else touch_camera.cancel();
        if (gesture_finished && event.type === 'pointerup') zoom_feedback();
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
    }
    touch_camera.cancel();
    if (inspect_start && event?.type === 'pointerup' && !panning) inspect_click(local_point(event));
    if (panning && event?.type === 'pointerup') audio.feedback('pan', 'Camera moved', { interval: 1200 });
    inspect_start = null;
    pointer_down = false; panning = false; last_paint = null; canvas.style.cursor = tool === 'inspect' ? 'grab' : 'crosshair';
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}
canvas.onpointerup = canvas.onpointercancel = end_pointer;
canvas.onpointerleave = () => { if (!pointer_down && !panning) renderer.pointer = null; $('world-tooltip').hidden = true; };
window.addEventListener('blur', () => end_pointer());
window.addEventListener('resize', () => end_pointer());
canvas.addEventListener('lostpointercapture', event => {
    if (touch_camera.points.has(event.pointerId)) touch_camera.cancel();
});
canvas.onwheel = event => {
    event.preventDefault(); const p = local_point(event);
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
    manual_zoom(Math.exp(-delta * 0.001), p.x, p.y);
};
$('minimap').onclick = event => {
    followed_unit_id = null;
    const rect = $('minimap').getBoundingClientRect();
    renderer.focus((event.clientX - rect.left) / rect.width * WIDTH, (event.clientY - rect.top) / rect.height * HEIGHT); update_zoom();
};
function inspect(p) {
    if (inspected_unit) { $('world-tooltip').hidden = true; return; }
    const ship = renderer.ship_at(world, p);
    if (ship) {
        const summary = ship_summary(world, ship), box = $('world-tooltip');
        if (summary) {
            box.textContent = `${summary.title} · ${summary.owner ? `${summary.owner.name}${summary.owner.alive ? '' : ' (inactive)'}` : 'Unknown kingdom'}${summary.crew?.members.length ? ` · ${summary.crew.label}: ${summary.crew.members.map(person => person.name).join(', ')}` : ''} · click to inspect`;
            box.hidden = false;
            box.style.left = `${Math.max(5, Math.min(p.x + 18, renderer.width - box.offsetWidth - 8))}px`;
            box.style.top = `${Math.max(70, Math.min(p.y + 18, renderer.height - box.offsetHeight - 96))}px`;
            return;
        }
    }
    const army = renderer.army_at(world, p);
    if (army) {
        const box = $('world-tooltip');
        box.textContent = `${world.villages.find(v => v.id === army.kingdom_id)?.name || 'Kingdom'} · ${army.count} soldiers · click banner to inspect`;
        box.hidden = false;
        box.style.left = `${Math.max(5, Math.min(p.x + 18, renderer.width - 205))}px`;
        box.style.top = `${Math.max(70, Math.min(p.y + 18, renderer.height - 150))}px`;
        return;
    }
    const tile = renderer.world_point(p.x, p.y);
    if (!world.inside(tile.x, tile.y)) { $('world-tooltip').hidden = true; return; }
    const box = $('world-tooltip'); box.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = TERRAIN_NAMES[world.tile(tile.x, tile.y)]; box.append(heading);
    const add = text => { const line = document.createElement('div'); line.textContent = text; box.append(line); };
    const people = world.people.filter(u => u.health > 0 && !u.voyage_id && Math.hypot(u.x - tile.x, u.y - tile.y) < 5).length;
    const animals = world.animals.filter(u => u.health > 0 && Math.hypot(u.x - tile.x, u.y - tile.y) < 5).length;
    add(`${people} people · ${animals} animals nearby`);
    const stump = world.stumps.get(world.index(tile.x, tile.y));
    if (stump) add(stump.age < FORESTRY.stump_seconds ? 'Cut stump · regrowth takes time'
        : 'Young sapling · growing before it can be harvested');
    else if (is_tree_site(world, tile.x, tile.y)) add(`Standing timber · ${(world.fertility[world.index(tile.x, tile.y)] * FORESTRY.wood_per_fertility).toFixed(1)} wood remaining`);

    const machine = world.machines.find(m => Math.hypot(m.x - tile.x, m.y - tile.y) < 2);
    const vehicle = world.vehicles.find(v => Math.hypot(v.x - tile.x, v.y - tile.y) < 2);
    if (machine) {
        add(`${MACHINES[machine.kind].label} · ${Math.ceil(machine.health)} health`);
        const crew = world.people.find(p => p.id === machine.crew_id && p.health > 0);
        add(crew ? `Crew: ${crew.name} · ${machine.crew_aboard ? 'click to inspect' : 'boarding'}` : 'Awaiting crew');
    } else if (vehicle) add(`${VEHICLES[vehicle.kind].label} · ${vehicle.cargo} food aboard`);
    else {
        const owner = world.villages.find(v => v.id === world.territory_at(tile.x, tile.y));
        const building = owner?.buildings?.find(b => Math.hypot(b.x - tile.x, b.y - tile.y) < 2);
        if (building) add(`${BUILDINGS[building.type].label}${building.type === 'farm' ? ` · crops ${Math.floor(building.growth * 100)}%` : ''}`);
        if (owner) add(`${owner.name} territory`);
        const deposit = world.ores[world.index(tile.x, tile.y)];
        if (deposit && !building) add(['', 'Copper vein', 'Tin vein', 'Iron vein', 'Coal seam', 'Stardust deposit'][deposit]);
    }
    if (world.fire[world.index(tile.x, tile.y)] > 0) add('Burning · use rain');
    add('Click life or ships to inspect · Kingdoms for town details');
    box.hidden = false;
    const bounds = box.getBoundingClientRect();
    box.style.left = `${Math.max(5, Math.min(p.x + 18, renderer.width - bounds.width - 8))}px`;
    box.style.top = `${Math.max(70, Math.min(p.y + 18, renderer.height - bounds.height - 96))}px`;
}
function inspect_click(p) {
    if ($('entity-card').hidden) delete $('entity-card').dataset.inspectorKey;
    const tile = renderer.world_point(p.x, p.y);
    const ship = renderer.ship_at(world, p);
    const army = ship ? null : renderer.army_at(world, p);
    const found = ship || army ? null : world.unit_near(tile.x, tile.y);
    inspected_unit = ship || (army ? { kind: 'army', id: army.home_id, kingdom_id: army.kingdom_id }
        : found ? { kind: found.kind, id: found.unit.id } : null);
    renderer.selected_unit_id = found?.unit.id || null;
    audio.feedback('inspect', ship ? `${ship_summary(world, ship)?.title || 'Ship'}, selected` : army ? `Army, ${army.count} soldiers`
        : found ? `${found.unit.name || found.unit.species}, selected` : 'Inspecting land');
    followed_unit_id = null;
    const card = $('entity-card'); card.hidden = !inspected_unit;
    if (!inspected_unit) {
        const owner = world.territory_at(tile.x, tile.y);
        if (owner != null) {
            focused_village_id = owner;
            document.body.classList.add('info-open', 'kingdom-inspecting'); update_selected_kingdom();
        }
    }
    if (inspected_unit) {
        document.body.classList.remove('info-open', 'kingdom-inspecting');
        $('world-info').classList.remove('active');
    }
    if (inspected_unit) {
        update_entity_card();
        card.style.left = `${Math.max(8, Math.min(p.x + 16, canvas.clientWidth - card.offsetWidth - 8))}px`;
        card.style.top = `${Math.max(8, Math.min(p.y + 16, canvas.clientHeight - card.offsetHeight - 8))}px`;
        $('world-tooltip').hidden = true;
    }
}
const ship_key = selection => selection?.kind === 'ship' ? `ship:${selection.collection}:${selection.id}` : null;
function update_ship_card() {
    const summary = ship_summary(world, inspected_unit), card = $('entity-card');
    if (!summary) {
        inspected_unit = null; followed_unit_id = null; card.hidden = true;
        toast('This ship has arrived or is no longer in the world.'); return;
    }
    const key = ship_key(inspected_unit), expanded = card.querySelector('[data-detail="ship"]')?.open;
    const scroll_top = card.scrollTop;
    const active = card.contains(document.activeElement) ? document.activeElement : null;
    const focused_action = active?.dataset.action, focused_summary = active?.tagName === 'SUMMARY';
    card.replaceChildren(); card.classList.remove('has-siege'); card.classList.add('ship-card');
    card.dataset.shipKey = key; card.setAttribute('aria-label', 'Selected ship details');
    const heading = document.createElement('div'); heading.className = 'entity-heading';
    const name = document.createElement('strong'); name.textContent = summary.title;
    const close = document.createElement('button'); close.dataset.action = 'close-ship';
    close.textContent = '×'; close.setAttribute('aria-label', 'Close ship details');
    close.onclick = () => { inspected_unit = null; followed_unit_id = null; card.hidden = true; };
    heading.append(name, close); card.append(heading);
    const identity = document.createElement('div'); identity.className = 'army-identity';
    const owner = document.createElement('strong');
    owner.textContent = summary.owner ? `${summary.owner.name}${summary.owner.alive ? '' : ' (inactive)'}` : 'Unknown kingdom';
    if (summary.owner) identity.append(kingdom_flag(summary.owner));
    identity.append(owner); card.append(identity);
    const activity = document.createElement('div'); activity.className = 'entity-activity';
    const action = document.createElement('strong');
    action.textContent = `${followed_unit_id === key ? '◉ Following · ' : ''}${summary.activity}`;
    activity.append(action); card.append(activity);
    const line = (label, value) => {
        const row = document.createElement('div'); row.className = 'entity-row';
        const name = document.createElement('span'); name.textContent = label;
        const text = document.createElement('b'); text.textContent = value;
        row.append(name, text); card.append(row); return row;
    };
    if (summary.health) line('Health', `${Math.ceil(summary.health.current)} / ${summary.health.max}`);
    if (summary.cargo) line('Cargo', `${summary.cargo.amount.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${summary.cargo.label}`);
    const location = point => `${point.label} · ${point.x.toFixed(1)}, ${point.y.toFixed(1)}`;
    if (summary.destination) line('Destination', location(summary.destination));
    if (summary.route) {
        const progress = document.createElement('progress'); progress.className = 'ship-progress';
        progress.max = 1; progress.value = summary.progress; progress.setAttribute('aria-label', 'Journey progress');
        card.append(progress); line('Journey', `${Math.floor(summary.progress * 100)}% complete`);
    }
    const reason = document.createElement('p'); reason.className = 'army-explanation'; reason.textContent = summary.reason;
    card.append(reason);
    const actions = document.createElement('div'); actions.className = 'entity-actions';
    const focus = document.createElement('button'); focus.dataset.action = 'focus-ship'; focus.textContent = 'Focus';
    focus.onclick = () => {
        if (ship_key(inspected_unit) !== key) return;
        const point = ship_position(world, inspected_unit);
        if (!point) { update_ship_card(); return; }
        followed_unit_id = null; renderer.focus(point.x, point.y, 4); update_zoom(); update_ship_card();
    };
    const follow = document.createElement('button'); follow.dataset.action = 'follow-ship';
    follow.textContent = followed_unit_id === key ? 'Stop following' : 'Follow';
    follow.setAttribute('aria-pressed', String(followed_unit_id === key));
    follow.onclick = () => {
        if (ship_key(inspected_unit) !== key) return;
        const point = ship_position(world, inspected_unit);
        if (!point) { update_ship_card(); return; }
        followed_unit_id = followed_unit_id === key ? null : key;
        if (followed_unit_id) { renderer.focus(point.x, point.y, 4); update_zoom(); }
        update_ship_card();
    };
    actions.append(focus, follow); card.append(actions);
    const detail = [line('Vessel', `${summary.category} · #${summary.vessel.id}`)];
    if (!summary.health) detail.push(line('Hull health', 'Not modeled'));
    if (!summary.cargo) detail.push(line('Cargo', 'Not modeled'));
    if (!summary.crew) detail.push(line('Crew', 'Not modeled'));
    detail.push(line('Passengers', summary.selection.collection === 'voyages' ? 'Not modeled separately' : 'Not modeled'));
    if (!summary.destination) detail.push(line('Destination', 'No directed route'));
    if (summary.boarding_point) detail.push(line('Crew boarding point', location(summary.boarding_point)));
    detail.push(line('Position', `${summary.point.x.toFixed(1)}, ${summary.point.y.toFixed(1)}`));
    if (summary.origin) detail.push(line('Origin', location(summary.origin)));
    if (summary.crew) {
        const crew = document.createElement('div'); crew.className = 'ship-crew';
        const label = document.createElement('strong');
        label.textContent = `${summary.crew.label}: ${summary.crew.members.length}${summary.crew.aboard === null ? '' : summary.crew.aboard ? ' · aboard' : ' · not aboard'}`;
        crew.append(label);
        for (const person of summary.crew.members) {
            if (summary.selection.collection === 'voyages') {
                const name = document.createElement('span'); name.className = 'ship-settler';
                name.textContent = `${person.name} · #${person.id}`; crew.append(name); continue;
            }
            const link = document.createElement('button'); link.dataset.action = `ship-person-${person.id}`;
            link.textContent = `Inspect ${person.name}`;
            link.onclick = () => {
                if (ship_key(inspected_unit) !== key || !ship_summary(world, inspected_unit)?.crew?.members.some(unit => unit.id === person.id)) return;
                inspected_unit = { kind: 'person', id: person.id }; followed_unit_id = null;
                renderer.selected_unit_id = person.id; card.scrollTop = 0; update_entity_card();
            };
            crew.append(link);
        }
        detail.push(crew);
    }
    if (summary.cargo?.sources) detail.push(line('Cargo sources', Object.entries(summary.cargo.sources)
        .map(([source, amount]) => `${source.replaceAll('_', ' ')} ${amount.toLocaleString(undefined, { maximumFractionDigits: 1 })}`).join(' · ')));
    const note = document.createElement('p'); note.className = 'army-explanation';
    note.textContent = summary.selection.collection === 'machines'
        ? 'Coastal boats fish and return food to a dock. Their health, assigned sailor and stored catch are simulated. They do not carry an army.'
        : summary.selection.collection === 'voyages'
            ? 'This voyage carries the named settlers to establish an outpost. Launch supplies are spent on departure; no remaining cargo or ship health is simulated.'
            : 'This shipment moves the recorded cargo between kingdoms. Separate ship health, crew and passenger records are not simulated.';
    detail.push(note);
    const disclosure = inspector_details(card, detail, 'Crew, route & vessel details', 'ship');
    disclosure.open = Boolean(expanded); card.scrollTop = scroll_top;
    if (focused_action) card.querySelector(`[data-action="${focused_action}"]`)?.focus({ preventScroll: true });
    if (focused_summary) disclosure.querySelector('summary').focus({ preventScroll: true });
}
function update_army_card() {
    const summary = army_summary(world, inspected_unit);
    const card = $('entity-card');
    if (!summary) {
        inspected_unit = null; followed_unit_id = null; card.hidden = true;
        toast('This garrison has dispersed or changed kingdom.'); return;
    }
    const { army, kingdom, home, target, members, activity, weapons, armor, strength } = summary;
    const expanded = card.querySelector('[data-detail="army"]')?.open;
    const scroll_top = card.scrollTop;
    const active = card.contains(document.activeElement) ? document.activeElement : null;
    const focused_action = active?.dataset.action;
    const focused_summary = active?.tagName === 'SUMMARY';
    card.replaceChildren(); card.setAttribute('aria-label', 'Selected army details');
    card.classList.toggle('has-siege', Boolean(summary.siege));
    const heading = document.createElement('div'); heading.className = 'entity-heading';
    const name = document.createElement('strong'); name.textContent = 'Home garrison';
    const close = document.createElement('button'); close.dataset.action = 'close-army';
    close.textContent = '×'; close.setAttribute('aria-label', 'Close army details');
    close.onclick = () => { inspected_unit = null; followed_unit_id = null; card.hidden = true; };
    heading.append(name, close); card.append(heading);
    const identity = document.createElement('div'); identity.className = 'army-identity';
    const kingdom_name = document.createElement('strong'); kingdom_name.textContent = kingdom.name;
    identity.append(kingdom_flag(kingdom), kingdom_name); card.append(identity);
    const state = document.createElement('div'); state.className = 'entity-activity';
    state.textContent = `${followed_unit_id === army.home_id ? '◉ Following · ' : ''}${activity.map(([task, count]) => `${count} ${task.toLowerCase()}`).join(' · ')}`;
    card.append(state);
    const line = (label, value) => {
        const row = document.createElement('div'); row.className = 'entity-row';
        const key = document.createElement('span'); key.textContent = label;
        const val = document.createElement('b'); val.textContent = value;
        row.append(key, val); card.append(row); return row;
    };
    const home_row = line('Home', home?.name || 'Former settlement');
    line('Members', `${members.length} active soldiers`);
    line('Order', summary.order_label);
    line('Target', target?.name || (army.target_id ? 'Changed · awaiting new plan' : 'No enemy target'));
    if (summary.siege) {
        const siege = summary.siege;
        const panel = document.createElement('section'); panel.className = 'army-siege';
        panel.setAttribute('aria-label', 'Target siege');
        const heading = document.createElement('div'); heading.className = 'siege-heading';
        const status = document.createElement('strong'); status.textContent = `${siege.kind === 'capital' ? 'Capital' : 'Town'} siege · ${siege.state}`;
        const focus_target = document.createElement('button'); focus_target.dataset.action = 'focus-target';
        focus_target.textContent = 'Target ↗'; focus_target.setAttribute('aria-label', `Focus target ${target.name}`);
        focus_target.onclick = () => {
            const current = inspected_unit && army_summary(world, inspected_unit)?.target;
            if (!current) return;
            followed_unit_id = null; renderer.focus(current.x, current.y, 4); update_zoom(); update_army_card();
        };
        heading.append(status, focus_target);
        const progress = document.createElement('progress'); progress.max = siege.required;
        progress.value = siege.progress; progress.setAttribute('aria-label', `${target.name} siege progress`);
        const amount = document.createElement('div'); amount.className = 'siege-amount';
        amount.textContent = `${Math.floor(siege.percent)}% · ${siege.progress.toFixed(1)} / ${siege.required} pressure`;
        const forces = document.createElement('div'); forces.className = 'siege-forces';
        forces.textContent = `${siege.attacker_name ? `Attacker: ${siege.attacker_name}` : 'No attacking kingdom'} · ${siege.attackers} attackers · ${siege.defenders} defenders${siege.fortification ? ` + ${siege.fortification} fortification` : ''}`;
        const rule = document.createElement('p'); rule.className = 'siege-rule'; rule.textContent = siege.rule;
        panel.append(heading, progress, amount, forces, rule); card.append(panel);
    }
    line('Shared food', `${Math.floor(kingdom.food)} in kingdom stores`);
    const explanation = document.createElement('p'); explanation.className = 'army-explanation';
    explanation.textContent = summary.order_reason;
    card.append(explanation);
    const actions = document.createElement('div'); actions.className = 'entity-actions';
    const focus = document.createElement('button'); focus.dataset.action = 'focus-army'; focus.textContent = 'Focus';
    focus.onclick = () => { renderer.focus(army.x, army.y, 4); update_zoom(); };
    const follow = document.createElement('button'); follow.dataset.action = 'follow-army';
    follow.textContent = followed_unit_id === army.home_id ? 'Stop following' : 'Follow';
    follow.setAttribute('aria-pressed', String(followed_unit_id === army.home_id));
    follow.onclick = () => {
        followed_unit_id = followed_unit_id === army.home_id ? null : army.home_id;
        if (followed_unit_id) { renderer.focus(army.x, army.y, 4); update_zoom(); }
        update_army_card();
    };
    actions.append(focus, follow); card.append(actions);
    const equipment = [line('Strength (sum)', String(strength)),
        line('Weapons', weapons.map(([level, count]) => `${count} ${TECH_AGES[level].weapon}`).join(' · ')),
        line('Armor', armor.map(([level, count]) => `${count} ${level ? TECH_AGES[level].name : 'no'} armor`).join(' · '))];
    if (summary.siege) equipment.unshift(home_row);
    const note = document.createElement('p'); note.className = 'army-explanation';
    note.textContent = 'The saved autonomous order guides movement; member tasks above show current activity. Strength sums living members’ strength; it is not a battle prediction. Food is shared by the kingdom; armies carry no separate supply stock. Siege pressure belongs to the target town and can involve several garrisons. Land routes use a bounded search and are checked as the army moves.';
    equipment.push(note);
    const detail = inspector_details(card, equipment, 'Equipment & how this works', 'army');
    detail.open = Boolean(expanded); card.scrollTop = scroll_top;
    if (focused_action) card.querySelector(`[data-action="${focused_action}"]`)?.focus({ preventScroll: true });
    if (focused_summary) detail.querySelector('summary').focus({ preventScroll: true });
}
function update_entity_card() {
    if (!inspected_unit) return;
    const card_identity = `${inspected_unit.kind}:${inspected_unit.collection || inspected_unit.kingdom_id || ''}:${inspected_unit.id}`;
    const current_card = $('entity-card');
    if (current_card.dataset.inspectorKey !== card_identity) {
        current_card.replaceChildren(); current_card.scrollTop = 0;
        current_card.dataset.inspectorKey = card_identity;
    }
    if (inspected_unit.kind === 'ship') { update_ship_card(); return; }
    $('entity-card').classList.remove('ship-card'); delete $('entity-card').dataset.shipKey;
    if (inspected_unit.kind === 'army') { update_army_card(); return; }
    const unit = (inspected_unit.kind === 'person' ? world.people : world.animals).find(u => u.id === inspected_unit.id);
    if (!unit) { inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; toast('This creature has left the world. Its story has ended.'); return; }
    const attributes = creature_stats(unit, world.year_length);
    const child = inspected_unit.kind === 'person' && unit.age < world.year_length * 18;
    const card = $('entity-card');
    card.classList.remove('has-siege');
    card.setAttribute('aria-label', 'Selected creature details');
    const detail_focus = card.contains(document.activeElement) ? document.activeElement.closest('[data-detail]')?.dataset.detail : null;
    const expanded = new Set([...card.querySelectorAll('details[open]')].map(d => d.dataset.detail));
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
    if (inspected_unit.kind === 'person') renderer.person(art, { ...unit, x: 0, y: 0 }, world.villages.find(v => v.id === unit.village_id), performance.now(), world.year_length);
    else renderer.animal(art, { ...unit, x: 0, y: 0 });
    card.append(portrait);
    const activity = document.createElement('div'); activity.className = 'entity-activity';
    const current_action = document.createElement('strong');
    current_action.textContent = `${followed_unit_id === unit.id ? '◉ Following · ' : ''}${unit.current_action || unit.task || (inspected_unit.kind === 'person' ? 'Exploring' : 'Roaming the wilds')}`;
    activity.append(current_action);
    if (unit.action_reason) {
        const reason = document.createElement('span'); reason.className = 'entity-action-reason';
        reason.textContent = unit.action_reason; activity.append(reason);
    }
    card.append(activity);
    const health = document.createElement('div'); health.className = 'entity-health';
    health.setAttribute('role', 'meter'); health.setAttribute('aria-label', 'Health');
    health.setAttribute('aria-valuemin', '0'); health.setAttribute('aria-valuemax', String(attributes.max_health)); health.setAttribute('aria-valuenow', String(Math.max(0, Math.ceil(unit.health))));
    const meter = document.createElement('span'); meter.style.width = `${Math.max(0, Math.min(100, unit.health / attributes.max_health * 100))}%`; health.append(meter); card.append(health);
    const needs = document.createElement('section'); needs.className = 'entity-needs';
    needs.setAttribute('aria-label', 'Hunger, energy and diet');
    const supernatural = ['angel', 'demon'].includes(unit.species);
    for (const [label, raw] of [['Hunger', Number.isFinite(unit.needs?.nutrition) ? 100 - unit.needs.nutrition : null], ['Energy', unit.needs?.energy]]) {
        if (supernatural || !Number.isFinite(raw)) continue;
        const value = Math.max(0, Math.min(100, raw));
        const field = document.createElement('label'); field.className = 'character-need';
        const text = document.createElement('span'); text.textContent = `${label} · ${Math.round(value)}/100`;
        const gauge = document.createElement('meter'); gauge.min = 0; gauge.max = 100; gauge.value = value;
        gauge.setAttribute('aria-label', label); gauge.setAttribute('aria-valuetext', label === 'Hunger'
            ? `${Math.round(value)} out of 100; higher means hungrier` : `${Math.round(value)} out of 100 energy remaining`);
        gauge.low = label === 'Hunger' ? 25 : 30; gauge.high = 65; gauge.optimum = label === 'Hunger' ? 0 : 100;
        field.append(text, gauge); needs.append(field);
    }
    const diet = document.createElement('span'); diet.className = 'entity-diet';
    diet.textContent = supernatural ? 'Supernatural · ordinary hunger does not apply'
        : `Diet · ${DIET_CATALOG.find(diet => diet.id === (unit.diet_id || 'omnivore'))?.label || 'Omnivore'}`;
    needs.append(diet); card.append(needs);
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
    line('Life stage', life_stage(unit, world.year_length));
    line('Level / XP', `${attributes.level} · ${Math.floor(unit.xp || 0)} / ${attributes.next_xp ?? 'Master'}`);
    line('Strength / Intelligence', `${attributes.strength} / ${attributes.intelligence}`);
    line('Trait', unit.trait || 'Unknown');
    const profile = character_editor.profile(unit, inspected_unit.kind, expanded);
    for (const gauge of profile.querySelectorAll('.character-need')) gauge.remove();
    card.append(profile);
    line('Kills', unit.kills || 0);
    line('Terrain', TERRAIN_NAMES[world.tile(unit.x, unit.y)]);
    if (inspected_unit.kind === 'person') {
        const kingdom = world.villages.find(v => v.id === unit.village_id);
        line('Kingdom', kingdom?.name || 'No kingdom');
        line('Food supply', kingdom ? `${Math.floor(kingdom.food)} shared · ${kingdom.food < 5 ? 'Food shortage' : 'Available'}` : 'No shared stores');
        if (kingdom?.king_id === unit.id) {
            line('Title', '♛ King');
            line('Reign', kingdom.king_since_year
                ? `Since Year ${kingdom.king_since_year} · ${world.year - kingdom.king_since_year + 1} ${world.year === kingdom.king_since_year ? 'year' : 'years'}`
                : 'Began before royal records');
            const heir = royal_successors(kingdom,
                world.people.filter(person => person.village_id === kingdom.id), world.year_length)[0];
            line('Heir', heir ? `${heir.name} · ${heir.parents?.some(p => p.id === unit.id) ? 'adult child' : 'by merit'}` : 'No eligible adult');
            const policy = ruler_personality(unit);
            const effect = { Scholar: '+15% research', Builder: '+12% production',
                Guardian: '+15% training', Diplomat: 'Favors alliances',
                Conqueror: 'More willing to wage war', Steward: 'Balanced policies' }[policy];
            line('Royal policy', `${policy} · ${effect}`);
        }
        const vessel = world.machines.find(m => m.crew_id === unit.id);
        line('Role', child ? 'Child' : vessel ? `${vessel.kind === 'boat' ? 'Sailor' : vessel.kind === 'artillery' ? 'Gunner' : 'Pilot'} · ${MACHINES[vessel.kind].label}` : unit.medical_role === 'doctor' ? 'Doctor' : unit.role === 'soldier' ? 'Soldier' : `${unit.job || 'civilian'} · civilian`);
        if (child && unit.job) line('Future aptitude', `${unit.job} · adult work begins at 18`);
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
        const routine = unit.daily_life;
        if (routine && !child && unit.role !== 'soldier' && !unit.prisoner_of && !unit.voyage_id && !unit.medical_role && !unit.recovering) {
            if (!Number.isFinite(unit.needs?.energy)) line('Routine energy', `${Math.round(routine.energy)} / 100`);
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
    const detail_rows = [...card.children].filter(e => e.classList.contains('entity-row') || e.classList.contains('family-links') || e.classList.contains('damage-history') || e.classList.contains('character-profile'));
    const primary_labels = new Set(['Species', 'Health', 'Condition', 'Age', 'Kingdom', 'Role',
        'Title', 'Reign', 'Heir', 'Royal policy']);
    const secondary = detail_rows.filter(e => !primary_labels.has(e.firstElementChild?.textContent));
    const detail = inspector_details(card, secondary, 'Health, traits, equipment & family', 'citizen');
    detail.open = expanded.has('citizen');
    card.scrollTop = scroll_top;
    follow.setAttribute('aria-pressed', String(followed_unit_id === unit.id));
    if (detail_focus && !focused_action) card.querySelector(`[data-detail="${detail_focus}"] > summary`)?.focus({ preventScroll: true });
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
        const ruler = document.createElement('span'); ruler.textContent = `King: ${world.people.find(p => p.id === source.king_id && p.health > 0)?.name || 'Awaiting an adult successor'}`;
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
        military.textContent = `${armies.length} garrisons · ${armies.filter(army => ['march', 'attack'].includes(army.state)).length} campaigning`;
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
    $('law-natural').checked = world.laws.natural_events;
    $('diplomacy-dialog').showModal();
};
$('law-diplomacy').onchange = event => { world.laws.diplomacy = event.target.checked; toast(`Autonomous diplomacy ${event.target.checked ? 'enabled' : 'disabled'}.`); };
$('law-expansion').onchange = event => { world.laws.expansion = event.target.checked; toast(`Kingdom expansion ${event.target.checked ? 'enabled' : 'disabled'}.`); };
$('law-natural').onchange = event => { world.laws.natural_events = event.target.checked; toast(`Natural events ${event.target.checked ? 'enabled' : 'disabled'}.`); };
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
    const detail_focus = box.querySelector('details > summary') === document.activeElement;
    const detail_open = box.querySelector('details')?.open || false;
    const focused_action = box.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    const box_scroll = box.closest('.info-panel').scrollTop;
    box.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = kingdom.name;
    heading.prepend(kingdom_flag(kingdom));
    const ruler = document.createElement('div'); ruler.className = 'royal-house';
    ruler.setAttribute('aria-label', 'King and succession');
    const culture = document.createElement('div');
    const leader = world.people.find(p => p.id === kingdom.king_id && p.health > 0);
    const heir = royal_successors(kingdom, residents, world.year_length)[0];
    const royal_link = (person, label, action) => {
        const row = document.createElement(person ? 'button' : 'span');
        row.textContent = `${label}: ${person?.name || 'No eligible adult'}`;
        if (person) {
            row.dataset.action = action;
            row.setAttribute('aria-label', `Inspect ${action === 'inspect-king' ? 'king' : 'heir'} ${person.name}`);
            row.onclick = () => {
                inspected_unit = { kind: 'person', id: person.id }; followed_unit_id = null;
                renderer.selected_unit_id = person.id; renderer.focus(person.x, person.y, 8);
                document.body.classList.remove('info-open', 'kingdom-inspecting');
                $('world-info').classList.remove('active');
                $('entity-card').hidden = false; $('entity-card').scrollTop = 0;
                update_zoom(); update_entity_card();
            };
        }
        ruler.append(row);
    };
    royal_link(leader, '♛ King', 'inspect-king');
    royal_link(heir, heir?.parents?.some(parent => parent.id === kingdom.king_id)
        ? 'Heir · adult child' : 'Heir · by merit', 'inspect-heir');
    const reign = document.createElement('small');
    reign.textContent = leader ? kingdom.king_since_year
        ? `Reign since Year ${kingdom.king_since_year}` : 'Reign began before royal records'
        : 'Crown vacant until an eligible adult can succeed';
    ruler.append(reign);
    const social = society_modifiers(kingdom, leader);
    culture.className = 'kingdom-culture';
    culture.textContent = `Culture: ${kingdom.culture.name} (${kingdom.culture.value}) · ${social.personality} royal policy`;
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
        ? `Army: ${armies.map(a => `${a.count} · ${a.state}${a.target_name ? ` → ${a.target_name}` : ''}`).join(' · ')}`
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
    box.append(heading, ruler, status, stats, age, stores, plan, march);
    const detail = inspector_details(box, [culture, influence, research, metals, settlements, buildings, care, transport, fleet_detail, diplomacy, release], 'Economy, culture, fleet & care', 'kingdom');
    detail.open = detail_open; box.append(manage);
    if (detail_focus) detail.querySelector('summary').focus({ preventScroll: true });
    if (focused_action) box.querySelector(`[data-action="${focused_action}"]`)?.focus({ preventScroll: true });
    box.closest('.info-panel').scrollTop = box_scroll;
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
    character_editor.refresh();
    $('layer-legend').hidden = renderer.layer === 'political';
    $('layer-legend').textContent = layer_summary(world, renderer.layer);
    $('weather-summary').textContent = world.weather.length ? `${world.weather.length} natural event${world.weather.length === 1 ? '' : 's'}` : '☁ Nature';
    $('weather-summary').title = world.weather.length ? world.weather.map(e => `${WEATHER[e.kind].label}: ${Math.ceil(WEATHER[e.kind].duration - e.age)}s remaining`).join(' · ') : 'Rain, storms and coastal disasters';
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
    $('time-summary').textContent = `Year ${world.year} · ${TECH_AGES[age_level].name}`;
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
            document.body.classList.add('kingdom-inspecting');
            $('selected-kingdom').scrollIntoView({ block: 'nearest' });
        };
        $('civilizations').append(button);
    }
    if (!stats.villages) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Place people on land to begin a civilization.'; $('civilizations').append(p); }
    update_selected_kingdom();
    const signature = JSON.stringify(world.events);
    audio.observe_events(world.events);
    if ($('chronicle').dataset.signature !== signature) {
        $('chronicle').dataset.signature = signature; $('chronicle').replaceChildren();
        $('chronicle').append(...world.events.slice(0, 6).map(event_row));
        if ($('history-dialog').open) update_history();
    }
}
function replace_world(next) {
    character_editor.close();
    delete $('entity-card').dataset.inspectorKey;
    $('creation-guide').dataset.completed = 'false';
    $('creation-guide').open = true;
    world = next; focused_village_id = null; inspected_unit = null; followed_unit_id = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; renderer.selected_kingdom_id = null;
    audio.reset_events(world.events);
    rebuild_armies(world);
    renderer.last_revision = -1; renderer.territory_last = -Infinity; renderer.fit(); renderer.pointer = null;
    end_pointer(); select_tool('inspect'); update_zoom(); update_ui(); set_pause(false); $('world-tooltip').hidden = true;
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
async function show_start_home() {
    set_pause(true);
    document.body.classList.remove('info-open'); $('world-info').classList.remove('active');
    $('start-home').hidden = false; $('start-ready').hidden = true;
    $('menu-resume').hidden = !world_started;
    $('menu-continue').disabled = true;
    saves.has_saved().then(saved => { $('menu-continue').disabled = !saved; });
    $('start-message').textContent = 'Choose a landscape, set the rules, and begin your world.';
    $('start-detail').textContent = 'Build it from empty ocean or choose a generated map.';
    $('start-screen').hidden = false;
}
$('menu').onclick = show_start_home;
$('world-info').onclick = () => {
    document.body.classList.remove('kingdom-inspecting');
    const open = !document.body.classList.contains('info-open');
    if (open) { inspected_unit = null; renderer.selected_unit_id = null; $('entity-card').hidden = true; }
    document.body.classList.toggle('info-open', open); $('world-info').classList.toggle('active', open);
};
$('close-world-info').onclick = () => { document.body.classList.remove('info-open'); $('world-info').classList.remove('active'); };
$('menu-create').onclick = $('menu-edit').onclick = $('new-world').onclick = open_world_setup;
$('menu-resume').onclick = close_start;
$('menu-start').onclick = close_start;
$('menu-paint').onclick = () => { $('start-screen').hidden = true; set_pause(true); };
$('menu-continue').onclick = () => saves.continue();
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
$('new-form').onsubmit = async event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim() || 'An Unwritten World';
    const seed = String(data.get('seed')).trim();
    const next = new World({ name, seed, preset: $('preset').value, inhabited: data.has('inhabited'), scenario: $('scenario').value });
    next.laws = { natural_events: data.has('natural_events'), diplomacy: data.has('diplomacy'), expansion: data.has('expansion'), rebellions: data.has('rebellions') };
    if (!await saves.transition(next, { reason: 'before-new' })) return;
    $('new-dialog').close(); show_start_ready(); toast('Your world is ready. Start time whenever you like.');
};
window.addEventListener('keydown', event => {
    if (!$('start-screen').hidden || document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); $('save').click(); return; }
    if (event.metaKey || event.ctrlKey) return;
    if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) set_pause(!paused); }
    if (['1', '2', '3', '4'].includes(event.key)) { set_speed({ 1: 1, 2: 2, 3: 5, 4: 20 }[event.key]); set_pause(false); }
    if (event.key.toLowerCase() === 'i') $('observe').click();
    if (event.key === 'F8') { event.preventDefault(); set_presentation(!document.body.classList.contains('presentation')); return; }
    if (event.key === 'Escape') {
        if (document.body.classList.contains('presentation')) set_presentation(false);
        else if ($('map-layers').open) $('map-layers').open = false;
        else $('observe').click();
    }
    if (event.key === '+' || event.key === '=') manual_zoom(1.2);
    if (event.key === '-') manual_zoom(1 / 1.2);
    if (['[', ']'].includes(event.key)) { $('brush').value = Math.max(1, Math.min(12, brush + (event.key === ']' ? 1 : -1))); $('brush').oninput(); }
    const movement = { a: [45, 0], d: [-45, 0], w: [0, 45], s: [0, -45] }[event.key.toLowerCase()];
    if (movement) {
        followed_unit_id = null; renderer.pan_by(...movement);
        audio.feedback('pan', 'Camera moved', { key: 'camera-pan', interval: 1200 });
    }
    update_zoom();
});
bind_audio_ui(audio);
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
    saves.frame(now, world_started && !document.hidden && !dialog_open && $('start-screen').hidden);
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
        const unit = inspected_unit?.kind === 'ship'
            ? ship_position(world, inspected_unit) : inspected_unit?.kind === 'army'
            ? world.armies.find(army => army.home_id === inspected_unit.id
                && army.kingdom_id === inspected_unit.kingdom_id)
            : world.people.find(p => p.id === followed_unit_id) || world.animals.find(a => a.id === followed_unit_id);
        if (unit) renderer.center_on(unit.x, unit.y); else followed_unit_id = null;
    }
    if (renderer.update_camera(dt)) update_zoom();
    renderer.touch_preview = touch_camera.editing ? touch_camera.stroke : [];
    renderer.selected_army = inspected_unit?.kind === 'army'
        ? { home_id: inspected_unit.id, kingdom_id: inspected_unit.kingdom_id } : null;
    renderer.selected_ship = inspected_unit?.kind === 'ship' ? inspected_unit : null;
    renderer.render(world, now);
    audio.observe_resources(world.effects, { origin: renderer.origin, scale: renderer.scale,
        width: renderer.width, height: renderer.height,
        active: !paused && !document.hidden && !dialog_open && $('start-screen').hidden });
    ui_elapsed += dt;
    if (ui_elapsed > 0.5) { update_ui(); ui_elapsed = 0; }
    requestAnimationFrame(frame);
}
show_tools(); select_tool('inspect'); update_ui(); show_start_home(); requestAnimationFrame(frame);
// A narrow, read-only diagnostic hook for the desktop smoke test.
window.genesis = Object.freeze({ snapshot: () => world.serialize(), stats: () => world.stats(),
    camera: () => ({ width: renderer.width, height: renderer.height, base: renderer.base,
        zoom: renderer.zoom, origin: renderer.origin }), visibility: () => ({ ...renderer.visibility }),
    audio: () => ({ ...audio.metrics, enabled: audio.settings.enabled, speaking: audio.speaking,
        pending: Boolean(audio.pending), local_voices: audio.voices().length, speech_error: audio.speech_error }) });
