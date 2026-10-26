const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-funerals-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'funerals');
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
        const { apply_damage } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'health.js')).href);
        const world = new World({ preset: 'empty', inhabited: false, seed: 'visible-funeral-art',
            name: 'A quiet cemetery and funeral pyre' });
        world.tiles.fill(T.GRASS);
        const home = world.found_village(60, 60);
        home.funeral_method = 'burial';
        world.add_person(61, 60, home.id);
        const carrier = world.people.at(-1);
        world.add_person(64, 60, home.id);
        const departed = world.people.at(-1);
        apply_damage(world, departed, 200, 'fire');
        world.clean_up();
        const cemetery = world.cemeteries.find(item => item.kingdom_id === home.id);
        const body = world.remains.find(item => item.id === departed.id);
        assert.ok(cemetery && body, 'fixture contains a valid cemetery and deceased resident');
        cemetery.buried = 1; cemetery.cremated = 1; cemetery.unrecovered = 1;
        body.carrier_id = carrier.id; body.stage = 'rites'; body.method = 'cremation'; body.paid = true;
        body.x = cemetery.x; body.y = cemetery.y;
        carrier.x = cemetery.x; carrier.y = cemetery.y;
        const fixture = world.serialize();
        World.deserialize(fixture);
        await fs.writeFile(path.join(artifacts, 'fixture.json'), JSON.stringify(fixture));

        const index = process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents',
                'Resources', 'app.asar', 'index.html') : path.join(__dirname, '..', 'index.html'));
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await click('#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(fixture))}], 'funeral-fixture.json',
            {type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open&&genesis.snapshot().name===`
            + JSON.stringify(world.name), 'funeral fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-paint');
        await js('document.querySelector("#zoom-reset").click()');
        await delay(250);
        const before = JSON.stringify(await js('genesis.snapshot()'));
        await delay(500);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before,
            'remains and cemetery stay unchanged while paused');
        await screenshot('cemetery-remains-pyre');
        const art_pixels = await js(`(()=>{const canvas=document.querySelector('#world'),ctx=canvas.getContext('2d'),
            cam=genesis.camera(),rect=canvas.getBoundingClientRect(),rx=canvas.width/rect.width,ry=canvas.height/rect.height,
            x=Math.round((cam.origin.x+${cemetery.x}*6*cam.base*cam.zoom)*rx),
            y=Math.round((cam.origin.y+${cemetery.y}*6*cam.base*cam.zoom)*ry),d=ctx.getImageData(x-18,y-18,36,36).data,
            colors=new Set();for(let i=0;i<d.length;i+=4)colors.add(d[i]+','+d[i+1]+','+d[i+2]);return colors.size})()`);
        assert.ok(art_pixels > 4, 'the memorial canvas contains visible grave and pyre artwork');
        checks.push('Native map renders cemetery markers, remains, and an active cremation pyre');

        const before_panel = JSON.stringify(await js('genesis.snapshot()'));
        await click('#diplomacy');
        await js(`(()=>{const details=[...document.querySelectorAll('#kingdom-profile details')]
            .find(item=>item.textContent.includes('Cemetery & funeral custom'));details.open=true})()`);
        assert.match(await js('document.querySelector("#kingdom-profile .wellbeing-headline").textContent'),
            /^Estimated happiness \d+% · \d+% satisfied$/);
        const totals = await js('document.querySelector("#kingdom-profile .funeral-totals").textContent');
        assert.match(totals, /1 buried · 1 cremated · 1 awaiting rest · 1 unrecovered/);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before_panel,
            'opening kingdom and funeral panels does not change the paused world');
        const services = await js(`(()=>{const d=[...document.querySelectorAll('#kingdom-profile details')]
            .find(item=>item.textContent.includes('Living conditions & public services'));
            d.open=true;return d.textContent})()`);
        for (const label of ['Food', 'Housing', 'Water', 'Clothing', 'Clean air', 'Healthcare', 'Detention', 'Taxes']) {
            assert.ok(services.includes(label), `public-service panel includes ${label}`);
        }
        await click('#kingdom-profile [data-funeral-method="cremation"]');
        assert.equal(await js('document.querySelector("#kingdom-profile [data-funeral-method=cremation]").getAttribute("aria-pressed")'), 'true');
        assert.equal((await js('genesis.snapshot()')).villages[0].funeral_method, 'cremation');
        const after_policy = JSON.stringify(await js('genesis.snapshot()'));
        checks.push('Kingdom panel shows funeral counts and persists the optional cremation policy');
        checks.push('Kingdom wellbeing shows its estimate, public services, and unknown fields without changing paused state');
        for (const width of [1024, 1366]) {
            win.setSize(width, 768); await delay(250);
            const fit = await js(`(()=>{const r=document.querySelector('#diplomacy-dialog').getBoundingClientRect();
                return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight
                    &&document.documentElement.scrollWidth<=innerWidth})()`);
            assert.equal(fit, true, `kingdom and funeral panel fits ${width}x768`);
            await screenshot(`kingdom-services-${width}`);
        }
        await click(`#kingdom-profile [data-focus-cemetery="${home.id}"]`);
        assert.equal(await js('document.querySelector("#diplomacy-dialog").open'), false);
        await screenshot('cemetery-focus');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), after_policy);
        checks.push('Focus cemetery closes the kingdom panel and centers the camera without changing saved state');
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
