const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), 'genesis-coastal-return-' + process.pid));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'coastal-return');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    const errors = [], checks = [], positions = [];
    win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message);
    });
    const js = code => win.webContents.executeJavaScript(code, true);
    const wait_for = async (condition, label) => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await js(condition)) return;
            await delay(100);
        }
        assert.fail('Timed out: ' + label);
    };
    const point_click = async (point, settle = 100) => {
        const p = { x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 };
        win.webContents.sendInputEvent({ type: 'mouseDown', ...p });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...p });
        if (settle) await delay(settle);
    };
    const control_point = selector => js('(()=>{const e=document.querySelector(' + JSON.stringify(selector)
        + ');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();'
        + 'return{x:r.x+r.width/2,y:r.y+r.height/2};})()');
    const click = async selector => point_click(await control_point(selector));
    const screenshot = async name => fs.writeFile(path.join(artifacts, name + '.png'),
        (await win.webContents.capturePage()).toPNG());
    try {
        const { World, T } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'simulation.js')).href);
        const world = new World({ preset: 'empty', inhabited: false, seed: 'concave-coast-return',
            name: 'Coastal return around a peninsula' });
        world.tiles.fill(T.GRASS);
        for (let y = 30; y <= 60; y++) for (let x = 30; x <= 60; x++) world.set_tile(x, y, T.OCEAN);
        for (let y = 30; y <= 52; y++) for (let x = 40; x <= 43; x++) world.set_tile(x, y, T.GRASS);
        world.set_tile(37, 36, T.GRASS); // Docks must survive ordinary building cleanup on land.
        for (const key of Object.keys(world.laws)) world.laws[key] = false;
        const home = world.found_village(28, 36);
        home.food = 100; home.food_stores = { plant: 100 }; home.wood = 0; home.research_level = 2;
        home.buildings = [{ type: 'dock', x: 37, y: 36, stock: 0, growth: 0, harvests: 0 }];
        world.add_person(home.x, home.y, home.id);
        const sailor = world.people[0];
        sailor.x = 47.5; sailor.y = 37.5;
        sailor.age = world.year_length * 30; sailor.trait_ids = []; sailor.diet_id = 'herbivore';
        sailor.infection = 0; sailor.task = 'Sailing coastal boat';
        const boat = { id: world.next_id++, kingdom_id: home.id, kind: 'boat', x: 47.5, y: 37.5,
            dx: -1, dy: 0, health: 180, decision: 0, cooldown: 0, cargo: 6, delivered: 0,
            recipient_id: null, fishing_timer: 0, crew_id: sailor.id, crew_aboard: true };
        world.machines.push(boat);
        const fixture = world.serialize();
        World.deserialize(fixture);
        await fs.writeFile(path.join(artifacts, 'fixture.json'), JSON.stringify(fixture));
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html')));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await click('#menu-load');
        await js('(()=>{const input=document.querySelector("#import"),dt=new DataTransfer();'
            + 'dt.items.add(new File([' + JSON.stringify(JSON.stringify(fixture))
            + '],"coastal-return.json",{type:"application/json"}));input.files=dt.files;'
            + 'input.dispatchEvent(new Event("change"));})()');
        await wait_for('!document.querySelector("#load-dialog").open&&genesis.snapshot().name==='
            + JSON.stringify(world.name), 'fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) {
            await js('document.querySelector("#menu-paint").click()');
        }
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Resume time');
        await delay(3500);
        await js('document.querySelector("#zoom-reset").click()'); await delay(200);
        const paused = await js('JSON.stringify(genesis.snapshot())');
        await point_click(await js('(()=>{const c=genesis.camera(),r=document.querySelector("#world").getBoundingClientRect();'
            + 'return{x:r.x+c.origin.x+' + boat.x + '*6*c.base*c.zoom,y:r.y+c.origin.y+'
            + boat.y + '*6*c.base*c.zoom};})()'));
        await wait_for('document.querySelector("#entity-card").dataset.shipKey==="ship:machines:' + boat.id + '"', 'native boat selection');
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("Returning catch")'));
        await click('[data-action="follow-ship"]');
        assert.equal(await js('document.querySelector("[data-action=follow-ship]").getAttribute("aria-pressed")'), 'true');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), paused);
        await screenshot('before-return');
        const pause_point = await control_point('#pause');
        const sample = async () => {
            const state = await js('(()=>{const w=genesis.snapshot(),b=w.machines.find(m=>m.id===' + boat.id
                + ');return{time:w.time,boat:b,water:b&&w.tiles[Math.floor(b.y)*192+Math.floor(b.x)]<=1};})()');
            assert.ok(state.boat && state.water, 'the observed boat remains on water');
            const previous = positions.at(-1);
            if (previous) assert.ok(Math.hypot(state.boat.x - previous.x, state.boat.y - previous.y)
                <= (state.time - previous.time) * 1.6 + 1e-6, 'observed motion respects boat speed');
            positions.push({ time: state.time, x: state.boat.x, y: state.boat.y,
                cargo: state.boat.cargo, delivered: state.boat.delivered });
            return state;
        };
        await sample();
        await click('[data-speed="20"]');
        const deadline = Date.now() + 15000;
        let delivered = false;
        while (Date.now() < deadline) {
            const state = await sample();
            if (state.boat.delivered >= 1) {
                await point_click(pause_point, 0); delivered = true; break;
            }
            await delay(50);
        }
        assert.ok(delivered, 'the real app must deliver within 15 actual seconds at 20x');
        await wait_for('document.querySelector("#pause").getAttribute("aria-label")==="Resume time"', 'native pause');
        const saved = await js('genesis.snapshot()');
        const final_boat = saved.machines.find(machine => machine.id === boat.id);
        const final_home = saved.villages.find(kingdom => kingdom.id === home.id);
        assert.equal(final_boat.delivered, 1);
        assert.equal(final_boat.cargo, 0);
        assert.equal(final_home.food_stores.fish, 6);
        assert.ok(final_home.food_stores.plant > 0, 'crew meals cannot consume the delivered fish');
        assert.ok(positions.some(point => point.y >= 53), 'the followed boat visibly rounds the peninsula');
        assert.ok(saved.people.some(person => person.id === sailor.id && person.health > 0));
        assert.ok(final_boat.crew_aboard);
        assert.deepEqual(World.deserialize(saved).serialize(), saved, 'the delivered state remains portable');
        const frozen = JSON.stringify(saved);
        await click('[data-action="focus-ship"]'); await delay(300);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), frozen);
        assert.equal(await js('document.querySelector("#entity-card").dataset.shipKey'), 'ship:machines:' + boat.id);
        await screenshot('ship-delivery');
        checks.push('Native ship selection and Follow leave a paused world unchanged');
        checks.push('Actual 20x boat rounds the concave coast on water and delivers one conserved 6-fish catch');
        checks.push('Native pause, post-delivery inspector and normalized save remain stable');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors, positions,
            delivery: { delivered: final_boat.delivered, cargo: final_boat.cargo,
                food_stores: final_home.food_stores } }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors, positions });
        win.destroy(); app.exit(1);
    }
});
