const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-siege-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'sieges');
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
        win.webContents.sendInputEvent({ type: 'mouseUp', ...p });
        await delay(120);
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
    const load_world = async save => {
        await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(save))}],'siege.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open && genesis.snapshot().name===${JSON.stringify(save.name)}`, 'fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-paint');
        assert.equal(await js(`document.querySelector('#pause').getAttribute('aria-label')`), 'Resume time');
        await delay(3500);
        // Fit is fixture setup, not the native behavior under test. Address the
        // button directly so resize/scroll hit coordinates cannot hit its slider.
        await js('document.querySelector("#zoom-reset").click()');
        assert.equal(await js('genesis.camera().zoom'), 1, 'Fit must synchronously cancel motion');
        const settled = await js('JSON.stringify(genesis.camera())');
        await delay(200);
        assert.equal(await js('JSON.stringify(genesis.camera())'), settled, 'Fit must stop camera easing before selection');
    };
    const select_army = async home_id => {
        const point = await js(`(()=>{const w=genesis.snapshot(),ps=w.people.filter(p=>p.village_id===${home_id}),
            c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect();
            return{x:r.x+c.origin.x+ps.reduce((sum,p)=>sum+p.x,0)/ps.length*6*c.base*c.zoom,
                y:r.y+c.origin.y+ps.reduce((sum,p)=>sum+p.y,0)/ps.length*6*c.base*c.zoom-18};})()`);
        await point_click(point);
        await wait_for(`document.querySelector('.army-siege') && !document.querySelector('#entity-card').hidden`, 'siege inspector');
    };
    try {
        const { World, T } = await import_src('simulation.js');
        const { army_identity } = await import_src('army_orders.js');
        const { siege_summary } = await import_src('sieges.js');
        const fixture = kind => {
            const world = new World({ preset: 'empty', inhabited: false, seed: `visible-${kind}`, name: `Visible ${kind} siege` });
            world.tiles.fill(T.GRASS); world.laws.diplomacy = false; world.laws.expansion = false;
            world.laws.rebellions = false; world.laws.natural_events = false;
            const home = world.found_village(30, 64), enemy = world.found_village(135, 64);
            home.food = 500; enemy.food = 500;
            const town = world.found_colony(enemy.id, 92, 64), target = kind === 'town' ? town : enemy;
            enemy.buildings.push({ type: 'castle', x: target.x + 2, y: target.y,
                growth: 0, harvests: 0, stock: 0, integrity: 300, defense_timer: 0 });
            for (let index = 0; index < 8; index++) {
                world.add_person(target.x - 3 + index * 0.25, target.y + 1, home.id);
                const person = world.people.at(-1); person.role = 'soldier'; person.task = 'Fighting';
            }
            for (let index = 0; index < 2; index++) {
                world.add_person(target.x + index, target.y, enemy.id);
                const person = world.people.at(-1); person.role = 'soldier'; person.home_id = target.id;
            }
            world.set_relation(home.id, enemy.id, 'war');
            world.army_orders = [{ id: army_identity(home.id, home.id), kingdom_id: home.id,
                home_id: home.id, state: 'attack', reason: 'attack', target_id: target.id, issued_tick: world.tick }];
            target.siege_attacker_id = home.id;
            target.siege = siege_summary(world, target).required / 2;
            return { world, home, enemy, target };
        };
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html')));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        for (const kind of ['town', 'capital']) {
            const { world, home, enemy, target } = fixture(kind);
            await fs.writeFile(path.join(artifacts, `${kind}-fixture.json`), JSON.stringify(world.serialize()));
            await load_world(world.serialize());
            const before = await js('JSON.stringify(genesis.snapshot())');
            const camera_before = await js('genesis.camera()');
            assert.equal(await js('genesis.visibility().sieges'), 1, 'Active target gets one restrained map badge');
            await select_army(home.id);
            assert.deepEqual(await js('genesis.camera()'), camera_before);
            const text = await js('document.querySelector(".army-siege").textContent');
            assert.ok(text.includes('50%') && text.includes(home.name) && text.includes('8 attackers'));
            assert.ok(text.includes('2 defenders + 3 fortification'));
            assert.ok(text.includes(kind === 'capital' ? 'surrender' : 'town'));
            assert.ok(await js(`document.querySelector('#entity-card').textContent.includes(${JSON.stringify(target.name)})`));
            for (const width of [1366, 1024]) {
                win.setSize(width, 768); await delay(200);
                await click('[data-action="focus-target"]');
                await js('document.querySelector("#entity-card").scrollTop=0'); await delay(150);
                assert.ok(await js(`(()=>{const card=document.querySelector('#entity-card').getBoundingClientRect(),
                    progress=document.querySelector('.army-siege progress').getBoundingClientRect();
                    return card.left>=0&&card.right<=innerWidth&&card.bottom<=innerHeight
                        &&progress.top>=card.top&&progress.bottom<=card.bottom
                        &&document.documentElement.scrollWidth<=innerWidth})()`));
                assert.equal(await js('genesis.visibility().sieges'), 1);
                assert.ok(await js(`(()=>{const c=genesis.camera();return Math.abs((c.width/2-c.origin.x)/(6*c.base*c.zoom)-${target.x})<0.02})()`));
                await screenshot(`${kind}-siege-${width}x768`);
            }
            for (const zoom of ['15', '65']) {
                await js(`document.querySelector('#zoom-slider').value='${zoom}';document.querySelector('#zoom-slider').dispatchEvent(new Event('input'))`);
                await delay(150); assert.equal(await js('genesis.visibility().sieges'), 1);
            }
            assert.equal(await js('JSON.stringify(genesis.snapshot())'), before,
                'Inspection, target focus, rendering and zoom preserve exact paused saved state');
            checks.push(`${kind}: named target, primary50% siege, attacker/defense, outcome rule, focus,1024/1366bounds, zoom and exact paused state`);
            await key('F8');
            assert.equal(await js('getComputedStyle(document.querySelector("#entity-card")).display'), 'none');
            await screenshot(`${kind}-siege-presentation`); await key('Escape');
            await click('#diplomacy');
            await js(`document.querySelector('#source-kingdom').value='${home.id}';document.querySelector('#source-kingdom').dispatchEvent(new Event('change'));document.querySelector('#target-kingdom').value='${enemy.id}';document.querySelector('#target-kingdom').dispatchEvent(new Event('change'))`);
            await click('[data-relation="peace"]'); await click('#diplomacy-dialog [data-close]');
            await delay(650);
            assert.equal(await js('document.querySelector(".army-siege")'), null);
            assert.equal(await js('genesis.visibility().sieges'), 0);
            const peace = await js('genesis.snapshot()');
            const saved_target = [...peace.villages, ...peace.colonies].find(site => site.id === target.id);
            assert.equal(saved_target.siege, target.siege, 'Peace inspection does not advance pressure decay');
            assert.equal(saved_target.siege_attacker_id, home.id);
            await key('Escape'); assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
            checks.push(`${kind}: presentation, peace invalidation, stale target badge removal and close`);
        }
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
