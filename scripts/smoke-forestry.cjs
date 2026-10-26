const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-forestry-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'forestry');
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
            e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();
            return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        const event = { x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 };
        win.webContents.sendInputEvent({ type: 'mouseDown', ...event });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...event });
        await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    try {
        const { World, T } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'simulation.js')).href);
        const { harvest_tree, advance_forestry, FORESTRY } = await import(
            pathToFileURL(path.join(__dirname, '..', 'src', 'forestry.js')).href);
        const make_fixture = stage => {
            const world = new World({ preset: 'empty', inhabited: false, seed: 'visible-tree-cycle',
                name: `Tree cycle: ${stage}` });
            world.tiles.fill(T.GRASS);
            const i = world.index(51, 50);
            world.tiles[i] = T.FOREST; world.fertility[i] = 1;
            if (stage !== 'mature') {
                harvest_tree(world, 51, 50, 20);
                if (stage === 'sapling') advance_forestry(world, FORESTRY.stump_seconds);
                if (stage === 'regrown') advance_forestry(world, FORESTRY.stump_seconds + FORESTRY.growth_seconds);
            }
            return world.serialize();
        };
        const fixtures = Object.fromEntries(['mature', 'stump', 'sapling', 'regrown']
            .map(stage => [stage, make_fixture(stage)]));
        for (const [stage, fixture] of Object.entries(fixtures)) {
            await fs.writeFile(path.join(artifacts, `${stage}.json`), JSON.stringify(fixture));
        }
        const index = process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents',
                'Resources', 'app.asar', 'index.html') : path.join(__dirname, '..', 'index.html'));
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        const load = async stage => {
            await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
            const fixture = fixtures[stage];
            await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
                dt.items.add(new File([${JSON.stringify(JSON.stringify(fixture))}],${JSON.stringify(stage + '.json')},
                {type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
            const expected = fixtures[stage];
            await wait_for(`!document.querySelector('#load-dialog').open&&genesis.snapshot().name===`
                + JSON.stringify(expected.name)
                + `&&genesis.snapshot().stumps.length===${expected.stumps.length}`,
                `${stage} fixture import`);
            if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-paint');
            await js('document.querySelector("#zoom-reset").click()');
            await delay(250);
            const state = await js('genesis.snapshot()');
            assert.equal(state.tiles[50 * 192 + 51], stage === 'mature' || stage === 'regrown' ? T.FOREST : T.GRASS);
            assert.equal((state.stumps || []).length, stage === 'stump' || stage === 'sapling' ? 1 : 0);
            const frozen = JSON.stringify(state);
            await delay(500);
            assert.equal(await js('JSON.stringify(genesis.snapshot())'), frozen,
                `${stage} save remains unchanged while native simulation is paused`);
            return state;
        };
        await load('mature');
        await screenshot('mature-canopy');
        const pixel_fingerprint = () => js(`(()=>{const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d'),
            cam=genesis.camera(),rect=canvas.getBoundingClientRect(),ratioX=canvas.width/rect.width,
            ratioY=canvas.height/rect.height,x=Math.round((cam.origin.x+51*6*cam.base*cam.zoom)*ratioX),
            y=Math.round((cam.origin.y+50*6*cam.base*cam.zoom)*ratioY),left=Math.max(0,x-18),top=Math.max(0,y-18),
            data=ctx.getImageData(left,top,36,36).data;let hash=2166136261;
            for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i],16777619);return hash>>>0})()`);
        const mature_pixels = await pixel_fingerprint();
        await load('stump'); await screenshot('felled-stump');
        const stump_pixels = await pixel_fingerprint();
        assert.notEqual(stump_pixels, mature_pixels, 'the canopy disappears and the stump is drawn in its place');
        const stump = await load('sapling'); await screenshot('young-sapling');
        const sapling_pixels = await pixel_fingerprint();
        assert.notEqual(sapling_pixels, stump_pixels, 'the sapling replaces the stump at the same map coordinate');
        const regrown = await load('regrown'); await screenshot('regrown-canopy');
        assert.equal(regrown.tiles[50 * 192 + 51], T.FOREST);
        assert.notEqual(await pixel_fingerprint(), stump_pixels, 'mature canopy returns after the growth cycle');
        checks.push('Native renderer shows mature tree, stump, sapling, and regrown canopy at one saved coordinate');
        checks.push('Save import preserves the stump and regrowth stages with a mature tree restored at completion');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure');
        console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
