const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-ship-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'ships');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    if (process.argv.includes('--visible')) win.showInactive();
    const errors = [], checks = [];
    win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message);
    });
    const js = code => win.webContents.executeJavaScript(code, true);
    const wait_for = async (condition, label) => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await js(condition)) return;
            await delay(100);
        }
        assert.fail(`Timed out: ${label}`);
    };
    const point_click = async point => {
        const p = { x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 };
        win.webContents.sendInputEvent({ type: 'mouseDown', ...p });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...p }); await delay(150);
    };
    const click = async selector => point_click(await js(`(()=>{
        const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});
        const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`));
    const key = async keyCode => {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode }); await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    const fit = async () => {
        // Fixture setup uses DOM Fit; selection and inspector controls remain native input.
        await js('document.querySelector("#zoom-reset").click()'); await delay(200);
    };
    const load_world = async save => {
        await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(save))}],'ships.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open && genesis.snapshot().name===${JSON.stringify(save.name)}`, 'fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await js('document.querySelector("#menu-paint").click()');
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Resume time');
        await delay(3500); await fit();
    };
    const select = async selection => {
        await point_click(await js(`(()=>{const w=genesis.snapshot(),c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect(),
            s=${JSON.stringify(selection)},v=w[s.collection].find(v=>v.id===s.id);
            const from=s.collection==='trades'?w.villages.find(k=>k.id===v.from_id):v,
                to=s.collection==='trades'?w.villages.find(k=>k.id===v.to_id):{x:v.target_x,y:v.target_y};
            const x=s.collection==='machines'?v.x:from.x+(to.x-from.x)*v.progress,
                y=s.collection==='machines'?v.y:from.y+(to.y-from.y)*v.progress;
            return{x:r.x+c.origin.x+x*6*c.base*c.zoom,y:r.y+c.origin.y+y*6*c.base*c.zoom};})()`));
        await wait_for(`!document.querySelector('#entity-card').hidden && document.querySelector('#entity-card').dataset.shipKey===${JSON.stringify(`ship:${selection.collection}:${selection.id}`)}`, 'native ship selection');
    };
    const open_details = async () => {
        if (!await js('document.querySelector("[data-detail=ship]").open')) await click('[data-detail="ship"] > summary');
    };
    try {
        const { World, T } = await import_src('simulation.js');
        const { MACHINES } = await import_src('machines.js');
        const world = new World({ preset: 'empty', inhabited: false, seed: 'ship-inspector-native', name: 'Three kinds of ship' });
        world.tiles.fill(T.OCEAN); world.laws.diplomacy = false; world.laws.expansion = false;
        world.laws.rebellions = false; world.laws.natural_events = false;
        for (let y = 20; y <= 108; y++) for (const [left, right] of [[10, 50], [130, 175]]) {
            for (let x = left; x <= right; x++) world.set_tile(x, y, T.GRASS);
        }
        const home = world.found_village(30, 64), recipient = world.found_village(150, 36);
        home.food = 300; home.wood = 100; recipient.food = 10;
        home.buildings.push({ type: 'dock', x: 49, y: 89, growth: 0, harvests: 0, stock: 0, integrity: 100, defense_timer: 0 });
        for (let index = 0; index < 8; index++) {
            world.add_person(home.x + index, home.y, home.id);
            const person = world.people.at(-1); person.age = world.year_length * 30;
            person.role = 'civilian'; delete person.medical_role; person.recovering = false;
        }
        assert.ok(world.launch_colony(home.id, 150, 100));
        const voyage = world.voyages[0]; voyage.progress = 0.5;
        assert.equal(voyage.kind, 'ship');
        assert.ok(world.launch_trade(home, recipient, 'food', 8, world.landmasses()));
        const trade = world.trades[0]; trade.progress = 0.5;
        assert.equal(trade.kind, 'ship');
        const sailor = world.people.find(person => !person.voyage_id);
        sailor.x = 68.5; sailor.y = 90; sailor.task = 'Sailing coastal boat';
        const boat = { id: world.next_id++, kingdom_id: home.id, kind: 'boat', x: sailor.x, y: sailor.y,
            dx: 1, dy: 0, health: MACHINES.boat.health, decision: 0, cooldown: 0,
            cargo: 6, fishing_timer: 10, recipient_id: null, delivered: 2, crew_id: sailor.id, crew_aboard: true };
        world.machines.push(boat);
        const shore_person = world.people.at(-1); shore_person.x = 50.5; shore_person.y = 90;
        const shore_boat = { ...boat, id: world.next_id++, x: 52.1, y: 90, cargo: 0,
            crew_id: null, crew_aboard: false };
        world.machines.push(shore_boat);
        const selections = [
            { kind: 'ship', collection: 'voyages', id: voyage.id },
            { kind: 'ship', collection: 'trades', id: trade.id },
            { kind: 'ship', collection: 'machines', id: boat.id }
        ];
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html')));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        const fixture = world.serialize();
        await fs.writeFile(path.join(artifacts, 'ship-fixture.json'), JSON.stringify(fixture));
        await load_world(fixture);
        const before = await js('JSON.stringify(genesis.snapshot())');
        for (const selection of selections) {
            await fit(); const camera = await js('genesis.camera()'); await select(selection);
            assert.deepEqual(await js('genesis.camera()'), camera, 'Selection must not move the camera');
            assert.equal(await js('document.querySelector("#entity-card").getAttribute("aria-label")'), 'Selected ship details');
            assert.ok(await js(`document.querySelector('#entity-card').textContent.includes(${JSON.stringify(home.name)})`));
            const labels = await js('[...document.querySelectorAll("#entity-card .entity-row")].map(row=>row.firstElementChild.textContent)');
            assert.equal(labels.includes('Health'), selection.collection === 'machines');
            assert.equal(labels.includes('Hull health'), selection.collection !== 'machines');
            assert.equal(Boolean(await js('document.querySelector(".ship-progress")')), selection.collection !== 'machines');
            await click('[data-action="focus-ship"]');
            await wait_for('Math.abs(genesis.camera().zoom-4)<0.01', 'ship focus');
            await click('[data-action="follow-ship"]');
            assert.equal(await js('document.querySelector("[data-action=follow-ship]").getAttribute("aria-pressed")'), 'true');
            await key('a'); await delay(550);
            assert.equal(await js('document.querySelector("[data-action=follow-ship]").getAttribute("aria-pressed")'), 'false');
            await open_details();
            const links = await js('document.querySelectorAll(".ship-crew button").length');
            assert.equal(links, selection.collection === 'machines' ? 1 : 0);
            assert.equal(await js('document.querySelectorAll(".ship-settler").length'), selection.collection === 'voyages' ? 3 : 0);
            assert.equal(await js('JSON.stringify(genesis.snapshot())'), before, 'Inspect, focus, follow and details must not mutate a paused world');
            await click('[data-action="close-ship"]'); assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        }
        checks.push('Native selection of settler, trade and coastal ships; exact anchors, distinct keys, actual fields only, pure paused Focus/Follow, named settlers and coastal crew link');
        await fit(); await select({ kind: 'ship', collection: 'machines', id: shore_boat.id });
        await click('[data-action="focus-ship"]'); await wait_for('Math.abs(genesis.camera().zoom-4)<0.01', 'shore boat focus');
        await point_click(await js(`(()=>{const c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect();
            return{x:r.x+c.origin.x+${shore_person.x}*6*c.base*c.zoom,y:r.y+c.origin.y+${shore_person.y}*6*c.base*c.zoom};})()`));
        assert.equal(await js('document.querySelector("#entity-card").getAttribute("aria-label")'), 'Selected creature details');
        assert.ok(await js(`document.querySelector('#entity-card').textContent.includes('#${shore_person.id}')`));
        checks.push('A nearby shore citizen outside the rendered coastal hull remains selectable at close zoom');
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(250);
            for (const selection of selections) {
                await fit(); await select(selection); await open_details();
                assert.ok(await js(`(()=>{const card=document.querySelector('#entity-card'),r=card.getBoundingClientRect();
                    return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight
                        &&card.scrollWidth<=card.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth;})()`));
                for (const action of ['close-ship', 'focus-ship', 'follow-ship']) {
                    assert.ok(await js(`(()=>{const e=document.querySelector('[data-action="${action}"]');
                        e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();
                        return r.width>=36&&r.height>=36&&r.top>=0&&r.bottom<=innerHeight;})()`));
                }
                await js('document.querySelector("#entity-card").scrollTop=0');
                await screenshot(`${selection.collection}-${width}x768`); await key('Escape');
            }
        }
        checks.push('All three ship categories fit at1366/1024 with bounded text and reachable close/focus/follow');
        await fit(); await select(selections[2]); await open_details();
        await click(`[data-action="ship-person-${sailor.id}"]`);
        assert.equal(await js('document.querySelector("#entity-card").getAttribute("aria-label")'), 'Selected creature details');
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("Sailor")'));
        await key('Escape'); await fit(); await select(selections[1]);
        await key('F8');
        assert.equal(await js('getComputedStyle(document.querySelector("#entity-card")).display'), 'none');
        await screenshot('ship-presentation'); await key('Escape');
        assert.equal(await js('document.querySelector("#entity-card").dataset.shipKey'), `ship:trades:${trade.id}`);
        const saved = await js('genesis.snapshot()'); await load_world(saved);
        assert.deepEqual(await js('genesis.snapshot()'), saved, 'Ship inspection preserves exact portable save state');
        assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        checks.push('Boat click wins over aboard sailor; crew profile remains accessible; presentation and save/load preserve the paused world and clear selection');
        const arriving = structuredClone(fixture); arriving.name = 'Arriving trade ship';
        arriving.trades[0].progress = 0.99; arriving.trades[0].duration = 6;
        await load_world(arriving); await select(selections[1]); await click('[data-action="follow-ship"]');
        await click('[data-speed="1"]');
        await wait_for('genesis.snapshot().trades.length===0 && document.querySelector("#entity-card").hidden', 'completed shipment clears inspector');
        await click('#pause'); const after_arrival = await js('JSON.stringify(genesis.snapshot())');
        await delay(600); assert.equal(await js('JSON.stringify(genesis.snapshot())'), after_arrival);
        assert.ok(await js('!document.querySelector("[data-action=follow-ship]") || document.querySelector("#entity-card").hidden'));
        await load_world(fixture); await select(selections[2]); await click('[data-action="follow-ship"]');
        await click('#new-world');
        await js(`(()=>{const f=document.querySelector('#new-form');f.elements.name.value='A fresh sea';
            document.querySelector('#preset').value='empty';document.querySelector('#inhabited').checked=false;f.requestSubmit();})()`);
        await wait_for('!document.querySelector("#new-dialog").open && genesis.snapshot().name==="A fresh sea"', 'new world replaces inspected vessel');
        assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        assert.equal(await js('genesis.snapshot().machines.length+genesis.snapshot().trades.length+genesis.snapshot().voyages.length'), 0);
        checks.push('Arrival safely clears a followed vessel, pause stays exact, and new-world creation clears ship selection/follow');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
