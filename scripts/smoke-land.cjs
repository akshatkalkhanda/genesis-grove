const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-land-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'settlement-land');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
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
    const click = async selector => {
        const point = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});
            if(!e)throw new Error('Missing ${selector}');e.scrollIntoView({block:'nearest'});
            const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        const event = { x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 };
        win.webContents.sendInputEvent({ type: 'mouseDown', ...event });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...event });
        await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    try {
        const { World, T } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'simulation.js')).href);
        const world = new World({ preset: 'empty', inhabited: false, seed: 'native-land-inspection',
            name: 'Owned fields and mountain mine' });
        world.tiles.fill(T.GRASS); world.fertility.fill(0.85);
        const kingdom = world.found_village(50, 50);
        kingdom.research_level = 3;
        kingdom.buildings.push(
            { type: 'farm', x: 52, y: 50, growth: 0.72, harvests: 2, stock: 18 },
            { type: 'windmill', x: 55, y: 51, growth: 0.4, harvests: 3, stock: 0 });
        world.add_person(54, 50, kingdom.id);
        const miner = world.people.at(-1);
        miner.x = 54.5; miner.y = 50.5; miner.job = 'miner';
        world.set_tile(56, 50, T.MOUNTAIN);
        world.ores[world.index(56, 50)] = 3;

        // Drop a pre-rule farm outside the old settlement radius. Import runs the one-time repair.
        kingdom.buildings.push({ type: 'farm', x: 112, y: 84, growth: 0.33, harvests: 4, stock: 11 });
        const legacy = world.serialize();
        delete legacy.land_rules;
        const fixture = JSON.stringify(legacy);
        const index = process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents',
                'Resources', 'app.asar', 'index.html') : path.join(__dirname, '..', 'index.html'));
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(fixture)}],'owned-land.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open&&genesis.snapshot().name===`
            + JSON.stringify(world.name), 'legacy fixture import and repair');
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-paint');
        await click('#zoom-reset');
        await delay(250);

        const state = await js('genesis.snapshot()');
        const repaired = state.villages[0].buildings.find(b => b.stock === 11);
        assert.ok(repaired && repaired.home_id === kingdom.id);
        assert.notDeepEqual([repaired.x, repaired.y], [112, 84], 'legacy farm is relocated inside its owner settlement');
        assert.equal(state.tiles[50 * 192 + 56], T.MOUNTAIN);
        assert.equal(state.ores[50 * 192 + 56], 3, 'mountain ore survives the save migration');
        assert.equal(state.land_rules, 1);
        checks.push('Legacy farm loads inside its owning settlement with its stock intact');
        checks.push('Mountain and finite ore are preserved in the imported saved world');

        const frozen = JSON.stringify(state);
        await delay(500);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), frozen,
            'the paused native world does not advance after import');
        checks.push('Imported land and mining fixture remains unchanged while paused');

        await click('#map-layers summary');
        await js('document.querySelector("#map-layers input[value=\'resources\']").click()');
        await delay(200);
        await screenshot('resources-territory-1366');
        const wide = await js(`(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,
            viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON(),
            camera:genesis.camera()}))()`);
        assert.equal(wide.width, 1366);
        assert.ok(wide.docWidth <= wide.width, 'wide layout has no horizontal overflow');

        win.setSize(1024, 768);
        await delay(500);
        await screenshot('resources-territory-1024');
        const compact = await js(`(()=>({width:innerWidth,docWidth:document.documentElement.scrollWidth,
            viewport:document.querySelector('#viewport').getBoundingClientRect().toJSON()}))()`);
        assert.equal(compact.width, 1024);
        assert.ok(compact.docWidth <= compact.width, 'compact layout has no horizontal overflow');
        checks.push('Territory and resource map layers render at 1366px and 1024px widths without overflow');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ passed: checks.length,
            checks, errors, wide, compact }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors, wide, compact }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure');
        console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
