import { World, WIDTH, HEIGHT, TERRAIN_NAMES, TECH_AGES, technology_level } from './simulation.js';
import { Renderer } from './renderer.js';
const $ = id => document.getElementById(id);
const TOOLS = {
    terrain: [
        ['grass', 'Meadow', '◆', '#a7c47b', 'Lay down fertile ground. Every great civilization starts somewhere.'],
        ['forest', 'Forest', '♠', '#8eb66c', 'Plant a living forest. Trees spread naturally and give villagers wood.'],
        ['ocean', 'Deep ocean', '≈', '#6aafc4', 'Carve oceans and separate continents. Land creatures cannot cross water.'],
        ['shallow', 'Shallows', '≋', '#82c7bb', 'Shape gentle coastlines with clear, shallow water.'],
        ['sand', 'Sand', '⠿', '#dfcb93', 'Paint golden beaches and quiet deserts. Life grows slowly here.'],
        ['hill', 'Highlands', '▰', '#a6b18b', 'Raise rolling highlands. A rugged home for adventurous settlers.'],
        ['mountain', 'Mountain', '▲', '#c3cec3', 'Raise impassable peaks. Nature has its own boundaries.'],
        ['lava', 'Lava', '♨', '#e8a26e', 'Pour molten rock. It cools to ash, and eventually life returns.']
    ],
    life: [
        ['human', 'Humans', '♟', '#e3cf9a', 'Place three settlers. Humans gather food reliably across all kinds of land.'],
        ['elf', 'Elves', '♧', '#a8d89b', 'Forest folk who gather timber faster and thrive among trees.'],
        ['dwarf', 'Dwarves', '⛏', '#d7a878', 'Hardy highland settlers who gather food from rugged land.'],
        ['orc', 'Orcs', '♜', '#99bd7a', 'Tough settlers who grow quickly and favor border raids.'],
        ['forest', 'Forest', '♠', '#8eb66c', 'Bring a woodland to life. Villagers gather timber here.'],
    ],
    creatures: [
        ['sheep', 'Sheep', '🐑', '#e9e3ca', 'Gentle grazers that feed on meadows and raise little flocks.'],
        ['wolf', 'Wolves', '🐺', '#b9bec4', 'Pack hunters that chase sheep and deer.'],
        ['deer', 'Deer', '🦌', '#c79d69', 'Shy forest grazers that flee from predators.'],
        ['bear', 'Bears', '🐻', '#b6825b', 'Powerful, territorial predators that hunt nearby wildlife.'],
        ['rabbit', 'Rabbits', '🐇', '#e0d7c5', 'Quick little grazers that multiply in fertile meadows.'],
        ['chicken', 'Chickens', '🐓', '#e8c866', 'Peaceful birds that forage and grow their flocks.']
    ],
    powers: [
        ['copper', 'Copper vein', '◆', '#dc9464', 'Place a copper deposit. Miners can collect it for copper-age research and weapons.'],
        ['tin', 'Tin vein', '◇', '#c4a778', 'Place tin for bronze research and bronze equipment.'],
        ['iron', 'Iron vein', '⬟', '#aab8c4', 'Place iron for iron-age research, swords, and armor.'],
        ['coal', 'Coal seam', '⬢', '#9a9d91', 'Place coal to fuel advanced research and forge work.'],
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
let world = new World();
const renderer = new Renderer($('world'), $('minimap'));
let category = 'terrain', tool = 'grass', previous_tool = 'grass', brush = 4, paused = false, speed = 1;
let focused_village_id = null;
let pointer_down = false, panning = false, last_pointer = null, paint_elapsed = 0, last_paint = null;
let toast_timer, audio_context, audio_gain, sound_on = false;
const storage_key = 'genesis-grove-world-v1';
function toast(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toast_timer); toast_timer = setTimeout(() => { $('toast').hidden = true; }, 3300);
}
function select_tool(id) {
    tool = id; renderer.tool = id;
    $('inspect').classList.toggle('active', id === 'inspect');
    $('world-tooltip').hidden = true;
    if (id === 'inspect') {
        $('selected-icon').textContent = '⌕'; $('selected-name').textContent = 'Inspect world';
        $('selected-description').textContent = 'Move over the world to discover its terrain, creatures, and nearby villages.';
    } else {
        previous_tool = id;
        const item = Object.values(TOOLS).flat().find(t => t[0] === id);
        $('selected-icon').textContent = item[2]; $('selected-name').textContent = item[1]; $('selected-description').textContent = item[4];
    }
    for (const button of $('tools').children) button.classList.toggle('active', button.dataset.tool === id);
}
function show_tools() {
    $('tools').replaceChildren();
    for (const [id, name, glyph, color] of TOOLS[category]) {
        const button = document.createElement('button'); button.className = 'tool'; button.dataset.tool = id;
        button.style.setProperty('--tool-color', color); button.title = name;
        const icon = document.createElement('span'); icon.className = 'glyph'; icon.textContent = glyph;
        const label = document.createElement('span'); label.textContent = name;
        button.append(icon, label); button.onclick = () => select_tool(id); $('tools').append(button);
    }
    select_tool(TOOLS[category].some(t => t[0] === tool) ? tool : TOOLS[category][0][0]);
}
for (const tab of document.querySelectorAll('[data-category]')) tab.onclick = () => {
    category = tab.dataset.category;
    for (const other of document.querySelectorAll('[data-category]')) other.setAttribute('aria-selected', String(other === tab));
    show_tools();
};
$('brush').oninput = () => { brush = Number($('brush').value); renderer.brush = brush; $('brush-value').textContent = `${brush} ${brush === 1 ? 'tile' : 'tiles'}`; };
function set_pause(value) {
    paused = value; $('pause').textContent = paused ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', paused ? 'Resume time' : 'Pause time'); $('paused-banner').hidden = !paused;
}
$('pause').onclick = () => set_pause(!paused);
function set_speed(value) {
    speed = value;
    for (const button of document.querySelectorAll('[data-speed]')) button.classList.toggle('active', Number(button.dataset.speed) === speed);
}
for (const button of document.querySelectorAll('[data-speed]')) button.onclick = () => { set_speed(Number(button.dataset.speed)); set_pause(false); };
function update_zoom() { $('zoom-reset').textContent = `${Math.round(renderer.zoom * 100)}%`; }
$('zoom-in').onclick = () => { renderer.zoom_at(1.25); update_zoom(); };
$('zoom-out').onclick = () => { renderer.zoom_at(0.8); update_zoom(); };
$('zoom-reset').onclick = $('fit').onclick = () => { renderer.fit(); update_zoom(); };
$('borders').onclick = () => { renderer.borders = !renderer.borders; $('borders').classList.toggle('active', renderer.borders); };
$('inspect').onclick = () => select_tool(tool === 'inspect' ? previous_tool : 'inspect');
function local_point(event) {
    const rect = $('world').getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function paint(p, continuous = false) {
    if (tool === 'inspect') return;
    if (continuous && ['meteor', 'nuke', 'lightning', 'human', 'elf', 'dwarf', 'orc', 'sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken'].includes(tool)) return;
    const tile = renderer.world_point(p.x, p.y);
    if (!world.inside(tile.x, tile.y)) return;
    if (['human', 'elf', 'dwarf', 'orc', 'sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken'].includes(tool) && !world.walkable(tile.x, tile.y)) { toast('Place life on meadows, forests, sand, or highlands.'); return; }
    if (last_paint && !['meteor', 'nuke', 'lightning', 'human', 'elf', 'dwarf', 'orc', 'sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken', 'rain', 'bless'].includes(tool)) {
        const distance = Math.hypot(tile.x - last_paint.x, tile.y - last_paint.y);
        const steps = Math.min(100, Math.ceil(distance / Math.max(1, brush / 2)));
        for (let i = 1; i < steps; i++) world.apply(tool, last_paint.x + (tile.x - last_paint.x) * i / steps, last_paint.y + (tile.y - last_paint.y) * i / steps, brush);
    }
    world.apply(tool, tile.x, tile.y, brush); last_paint = tile;
    if (['meteor', 'lightning'].includes(tool)) power_sound(tool);
}
const canvas = $('world');
canvas.oncontextmenu = event => event.preventDefault();
canvas.onpointerdown = event => {
    if (![0, 1, 2].includes(event.button)) return;
    const p = local_point(event); last_pointer = p; renderer.pointer = p;
    panning = event.button !== 0 || event.altKey;
    pointer_down = !panning; last_paint = null; paint_elapsed = 0;
    canvas.setPointerCapture(event.pointerId);
    if (pointer_down) paint(p);
    if (panning) canvas.style.cursor = 'grabbing';
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
canvas.onwheel = event => { event.preventDefault(); const p = local_point(event); renderer.zoom_at(Math.exp(-event.deltaY * 0.0015), p.x, p.y); update_zoom(); };
$('minimap').onclick = event => {
    const rect = $('minimap').getBoundingClientRect();
    renderer.focus((event.clientX - rect.left) / rect.width * WIDTH, (event.clientY - rect.top) / rect.height * HEIGHT); update_zoom();
};
function inspect(p) {
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
    if (deposit) add(['', 'Copper vein', 'Tin vein', 'Iron vein', 'Coal seam'][deposit]);
    const site = [...world.colonies, ...world.villages.filter(v => v.alive)].find(v => Math.hypot(v.x - tile.x, v.y - tile.y) < 9);
    if (site) {
        const kingdom = site.kingdom_id ? world.villages.find(v => v.id === site.kingdom_id) : site;
        add(site.name); add(`${kingdom?.name || 'Lost kingdom'} · ${site.houses.length} homes`);
        if (kingdom) add(`${Math.floor(kingdom.food)} food · ${Math.floor(kingdom.wood)} wood`);
    }
    if (world.fire[world.index(tile.x, tile.y)] > 0) add('Burning · use rain to extinguish');
    box.hidden = false; box.style.left = `${Math.max(5, Math.min(p.x + 18, renderer.width - 205))}px`; box.style.top = `${Math.max(70, Math.min(p.y + 18, renderer.height - 150))}px`;
}
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
        const alliances = alive.filter(v => v.id !== source.id && world.relation_status(v.id, source.id) === 'alliance').length;
        const wars = alive.filter(v => v.id !== source.id && world.relation_status(v.id, source.id) === 'war').length;
        const heading = document.createElement('strong'); heading.textContent = source.name; heading.style.setProperty('--kingdom-color', source.color);
        const details = document.createElement('span'); details.textContent = `${population} people · ${colonies.length + 1} towns · founded year ${source.founded_year || 1}`;
        const technology = document.createElement('span');
        const level = technology_level(source);
        technology.className = 'technology-detail'; technology.style.setProperty('--technology-color', TECH_AGES[level].color);
        technology.textContent = `${TECH_AGES[level].name} · ${TECH_AGES[level].weapon} · gear improves damage and protection`;
        const ore = source.ore || {};
        const resources = document.createElement('span'); resources.textContent = `${Math.floor(source.food)} food · ${Math.floor(source.wood)} wood · Cu ${ore.copper || 0} · Sn ${ore.tin || 0} · Fe ${ore.iron || 0} · coal ${ore.coal || 0}`;
        const arsenal = document.createElement('span'); arsenal.textContent = `${source.weapons || 0} spare weapons · ${source.armor_stock || 0} spare armor · ${source.deaths || 0} deaths`;
        const relations = document.createElement('span'); relations.textContent = `${alliances} alliances · ${wars} wars`;
        profile.append(heading, details, technology, resources, arsenal, relations);
        if (colonies.length) {
            const towns = document.createElement('small'); towns.textContent = `Towns: ${colonies.map(c => c.name).join(', ')}`;
            profile.append(towns);
        }
    }
    $('relation-status').textContent = status === 'alliance' ? 'Allied kingdoms exchange extra supplies when nearby.' : status === 'war' ? 'At war: nearby people fight and border raids can occur.' : status === 'peace' ? 'At peace: neighbouring kingdoms may trade.' : 'Create at least two living kingdoms to manage relations.';
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
function update_ui() {
    const stats = world.stats();
    for (const id of ['population', 'wildlife', 'villages', 'towns', 'trees']) $(id).textContent = stats[id].toLocaleString();
    $('civ-count').textContent = stats.villages; $('land-percent').textContent = `${stats.land}% land`;
    $('survival').hidden = world.scenario !== 'hundred';
    const founders = world.villages.slice(0, 100).filter(v => v.alive).length;
    $('survival').textContent = `${founders} of 100 founding kingdoms survive · ${Math.min(world.year, 1000)} / 1,000 years`;
    $('world-name').textContent = world.name; $('world-type').textContent = world.scenario === 'hundred' ? '100 KINGDOMS' : 'SANDBOX'; $('year').textContent = world.year;
    const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];
    $('season').textContent = `${seasons[Math.floor(world.time / 5) % 4]} · Year ${world.year}`;
    const living_kingdoms = world.villages.filter(v => v.alive);
    const average_technology = living_kingdoms.length
        ? living_kingdoms.reduce((sum, v) => sum + (v.tech_points || 0), 0) / living_kingdoms.length : 0;
    const age_level = technology_level({ tech_points: average_technology });
    const age = TECH_AGES[age_level], next_age = TECH_AGES[age_level + 1];
    const progress = next_age ? (average_technology - age.threshold) / (next_age.threshold - age.threshold) : 1;
    $('age-label').textContent = age.name.toUpperCase();
    $('era').textContent = `${age.name} · ${age.weapon.toLowerCase()}s`;
    $('age-progress').style.width = `${Math.max(0, Math.min(100, progress * 100))}%`;
    document.querySelector('.map-label').style.setProperty('--age-color', age.color);
    for (const [index, step] of [...document.querySelectorAll('.age-stages span')].entries()) {
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
        const dot = document.createElement('span'); dot.className = 'civ-dot';
        const name = document.createElement('span'); name.className = 'civ-name'; name.textContent = v.name;
        const towns = world.colonies.filter(c => c.kingdom_id === v.id).length + 1;
        const small = document.createElement('small'); small.textContent = `${towns} ${towns === 1 ? 'town' : 'towns'} · ${TECH_AGES[technology_level(v)].name}${warring.has(v.id) ? ' · ⚔ at war' : ''}`; name.append(small);
        const count = document.createElement('span'); count.className = 'civ-pop'; count.textContent = `${pop} ♟`;
        button.append(dot, name, count); button.onclick = () => { focused_village_id = v.id; renderer.focus(v.x, v.y); update_zoom(); update_ui(); toast(`${v.name} · ${pop} people · ${Math.floor(v.wood)} timber`); };
        $('civilizations').append(button);
    }
    if (!stats.villages) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Place people on land to begin a civilization.'; $('civilizations').append(p); }
    const signature = JSON.stringify(world.events.slice(0, 6));
    if ($('chronicle').dataset.signature !== signature) {
        $('chronicle').dataset.signature = signature; $('chronicle').replaceChildren();
        for (const event of world.events.slice(0, 6)) {
            const item = document.createElement('div'); item.className = 'event';
            const when = document.createElement('small'); when.textContent = `YEAR ${event.year}`;
            const text = document.createElement('p'); text.textContent = event.text; item.append(when, text); $('chronicle').append(item);
        }
    }
}
function replace_world(next) {
    world = next; focused_village_id = null; renderer.last_revision = -1; renderer.territory_last = -Infinity; renderer.fit(); renderer.pointer = null;
    end_pointer(); update_zoom(); update_ui(); set_pause(false); $('world-tooltip').hidden = true;
}
$('new-world').onclick = () => $('new-dialog').showModal();
$('scenario').onchange = () => {
    const challenge = $('scenario').value === 'hundred';
    $('scenario-note').hidden = !challenge;
    if (challenge) { $('preset').value = 'fractured'; $('inhabited').checked = true; }
    $('preset').disabled = $('inhabited').disabled = challenge;
};
$('help').onclick = () => $('help-dialog').showModal();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => button.closest('dialog').close();
$('new-form').onsubmit = event => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim() || 'An Unwritten World';
    const seed = String(data.get('seed')).trim() || String(Date.now());
    replace_world(new World({ name, seed, preset: data.get('preset'), inhabited: data.has('inhabited'), scenario: data.get('scenario') }));
    $('new-dialog').close(); toast('A new chapter. This one is yours.');
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
    try { replace_world(World.deserialize(JSON.parse(localStorage.getItem(storage_key)).world)); $('load-dialog').close(); toast('Welcome back to your world.'); }
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
        replace_world(next); $('load-dialog').close(); toast('Your world has arrived.');
    } catch (error) { toast(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message); }
    event.target.value = '';
};
window.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
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
    if (movement) { renderer.pan_x += movement[0]; renderer.pan_y += movement[1]; }
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
let last_frame = performance.now(), accumulator = 0, ui_elapsed = 0;
function frame(now) {
    const dt = Math.min((now - last_frame) / 1000, 0.1); last_frame = now;
    const dialog_open = Boolean(document.querySelector('dialog[open]'));
    if (!document.hidden && !dialog_open) {
        if (!paused) {
            accumulator += dt * speed;
            let steps = 0;
            while (accumulator >= 0.125 && steps < 16) { world.step(0.125); accumulator -= 0.125; steps++; }
            accumulator = Math.min(accumulator, 2);
        }
        if (pointer_down && last_pointer) { paint_elapsed += dt; if (paint_elapsed > 0.085) { paint(last_pointer, true); paint_elapsed = 0; } }
    }
    renderer.render(world, now);
    ui_elapsed += dt;
    if (ui_elapsed > 0.5) { update_ui(); ui_elapsed = 0; }
    requestAnimationFrame(frame);
}
show_tools(); update_ui(); requestAnimationFrame(frame);
// A narrow, read-only diagnostic hook for the desktop smoke test.
window.genesis = Object.freeze({ snapshot: () => world.serialize(), stats: () => world.stats(), camera: () => ({ width: renderer.width, height: renderer.height, base: renderer.base, zoom: renderer.zoom, origin: renderer.origin }) });
