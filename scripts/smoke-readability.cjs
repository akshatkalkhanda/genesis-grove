const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), 'genesis-readability-' + process.pid));
app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    const errors = [], checks = [];
    win.webContents.on('console-message', details => {
        if (details.level === 'error') errors.push(details.message);
    });
    const js = code => win.webContents.executeJavaScript(code, true);
    const click = selector => js('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const artifacts = process.env.GENESIS_READABILITY_OUTPUT
        || path.join(__dirname, '..', 'artifacts', 'readability');
    try {
        await fs.mkdir(artifacts, { recursive: true });
        const module_url = name => pathToFileURL(path.join(__dirname, '..', 'src', name)).href;
        const { World, T } = await import(module_url('simulation.js'));
        const { MACHINES } = await import(module_url('machines.js'));
        const { settlement_labels, home_populations } = await import(module_url('map_readability.js'));
        const fixture = new World({ preset: 'empty', inhabited: false,
            name: 'Readable Metropolis', seed: 'readable-city' });
        fixture.tiles.fill(T.GRASS);
        const capital = fixture.found_village(96, 64);
        capital.food = 10000; capital.research_level = 9; capital.tech_points = 800;
        capital.houses = Array.from({ length: 64 }, (_, i) => ({
            x: 84 + i % 8 * 3, y: 52 + Math.floor(i / 8) * 3 }));
        for (let i = 0; i < 100; i++) {
            fixture.add_person(86 + i % 10 * 2, 55 + Math.floor(i / 10) * 2, capital.id);
            fixture.people.at(-1).armor_level = 9; fixture.people.at(-1).weapon_level = 9;
        }
        capital.buildings = ['castle', 'watchtower', 'prison', 'aerodrome', 'workshop', 'farm',
            'windmill', 'university', 'school', 'church', 'temple', 'well', 'granary', 'market',
            'monument', 'stargate'].map((type, i) => ({ type, x: 84 + i % 4 * 6,
                y: 50 + Math.floor(i / 4) * 8, growth: 0.8, harvests: 0, stock: 0, integrity: 100 }));
        for (let i = 0; i < 16; i++) fixture.found_colony(capital.id,
            86 + i % 4 * 6, 52 + Math.floor(i / 4) * 7);
        for (const [kind, x, y] of [['artillery', 90, 60], ['balloon', 98, 60],
            ['plane', 98, 68], ['airship', 104, 64]]) {
            fixture.machines.push({ id: fixture.next_id++, kingdom_id: capital.id, kind, x, y,
                dx: 1, dy: 0, health: MACHINES[kind].health, decision: 0, cooldown: 0,
                cargo: 0, recipient_id: null, delivered: 0 });
        }
        const save = process.env.GENESIS_READABILITY_WORLD
            ? JSON.parse(await fs.readFile(process.env.GENESIS_READABILITY_WORLD, 'utf8')) : fixture.serialize();
        World.deserialize(save);
        const packaged = path.join(__dirname, '..',
            'dist/mac-arm64/Genesis Grove.app/Contents/Resources/app.asar/index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX
            || (process.argv.includes('--packaged') ? packaged : path.join(__dirname, '..', 'index.html')));
        await click('#menu-load');
        await js("(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();"
            + 'dt.items.add(new File([' + JSON.stringify(JSON.stringify(save))
            + "],'readability.json',{type:'application/json'}));input.files=dt.files;"
            + "input.dispatchEvent(new Event('change'));})()");
        for (let i = 0; i < 100
            && !await js('genesis.snapshot().name===' + JSON.stringify(save.name)); i++) await delay(100);
        assert.equal(await js('genesis.snapshot().name'), save.name);
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-start');
        if (!await js('document.querySelector("#pause").textContent.includes("Resume")')) await click('#pause');
        await click('#observe');
        const before = await js('JSON.stringify(genesis.snapshot())');
        await delay(3400);
        checks.push('Dense saved city imports and remains paused');
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(200);
            for (const zoom of [1, 5.01]) {
                await click('#zoom-reset');
                if (process.env.GENESIS_READABILITY_FOCUS) {
                    const focus = process.env.GENESIS_READABILITY_FOCUS.split(',').map(Number);
                    const camera = await js('genesis.camera()');
                    const rect = await js("(()=>{const r=document.querySelector('#world').getBoundingClientRect();return{x:r.x,y:r.y}})()");
                    const start = { x: Math.round(rect.x + camera.origin.x + focus[0] * 6 * camera.base),
                        y: Math.round(rect.y + camera.origin.y + focus[1] * 6 * camera.base) };
                    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'right', ...start });
                    win.webContents.sendInputEvent({ type: 'mouseMove', button: 'right',
                        x: Math.round(rect.x + camera.width / 2), y: Math.round(rect.y + camera.height / 2) });
                    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'right',
                        x: Math.round(rect.x + camera.width / 2), y: Math.round(rect.y + camera.height / 2) });
                }
                await js("(()=>{const e=document.querySelector('#zoom-slider');e.value=String(Math.log("
                    + zoom + "/0.65)/Math.log(24/0.65)*100);e.dispatchEvent(new Event('input'));})()");
                await delay(400);
                win.webContents.sendInputEvent({ type: 'mouseMove', x: 5, y: 5 });
                await delay(60);
                const camera = await js('genesis.camera()');
                const labels = settlement_labels(save, { zoom: camera.zoom, selected: null,
                    origin: camera.origin, scale: camera.base * camera.zoom, width: camera.width,
                    height: camera.height }, home_populations(save), name => name.length * 7);
                assert.ok(labels.length <= 10);
                assert.ok(labels.every(label => home_populations(save).get(label.site.id) > 0));
                assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
                await fs.writeFile(path.join(artifacts, 'dense-' + width + '-' + zoom + '.png'),
                    (await win.webContents.capturePage()).toPNG());
            }
        }
        checks.push('Overview and five-times city zoom fit 1366/1024 layouts with bounded inhabited labels');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before,
            'View changes cannot mutate the world');
        checks.push('Zoom and readability changes preserve exact simulation state');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ checks, errors }, null, 2));
    } catch (error) { console.error(error); process.exitCode = 1; }
    finally { win.destroy(); app.quit(); }
});
