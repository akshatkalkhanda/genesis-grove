const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-review-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'review-fixes');
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
    const fit = async () => { await js('document.querySelector("#zoom-reset").click()'); await delay(200); };
    const select = async (kind, id) => {
        const point = await js(`(()=>{const u=genesis.snapshot().${kind === 'person' ? 'people' : 'animals'}.find(u=>u.id===${id}),
            c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect();
            return{x:r.x+c.origin.x+u.x*6*c.base*c.zoom,y:r.y+c.origin.y+u.y*6*c.base*c.zoom};})()`);
        await point_click(point);
        await wait_for(`!document.querySelector('#entity-card').hidden&&document.querySelector('#entity-card').dataset.inspectorKey===${JSON.stringify(`${kind}::${id}`)}`, 'creature selection');
    };
    try {
        const { World, T } = await import_src('simulation.js');
        const world = new World({ preset: 'empty', inhabited: false, seed: 'review-fixes-native', name: 'Readable individual lives' });
        world.tiles.fill(T.GRASS); world.laws.diplomacy = false; world.laws.expansion = false;
        world.laws.rebellions = false; world.laws.natural_events = false;
        const home = world.found_village(55, 64); home.food = 200;
        for (const [x, age] of [[60, 30], [85, 30], [72, 0], [78, 4]]) {
            world.add_person(x, 64, home.id); world.people.at(-1).age = age * world.year_length;
        }
        const [first, second, newborn, child] = world.people;
        home.king_id = second.id;
        first.trait_ids = ['unlucky', 'weak', 'slow', 'stupid', 'long_lived', 'regeneration', 'honest', 'aggressive'];
        first.weapon_level = 13; first.armor_level = 13;
        first.recent_events = Array.from({ length: 8 }, (_, index) => ({ time: 0, text: `Recorded personal event ${index + 1}.` }));
        newborn.job = 'lumberjack'; child.job = 'farmer';
        for (let index = 0; index < 12; index++) {
            world.add_person(60 + (index % 4) * 0.75, 65 + Math.floor(index / 4) * 0.75, home.id);
            const person = world.people.at(-1); person.weapon_level = 13; person.armor_level = 13;
        }
        world.add_animal(95, 64, 'wolf'); const wolf = world.animals.at(-1);
        world.add_animal(102, 64, 'angel'); const angel = world.animals.at(-1);
        // Use the real child routine before importing a paused snapshot.
        world.step(0.125);
        for (const person of [first, second, newborn, child]) {
            person.needs.nutrition = 80; person.needs.energy = 70;
        }
        const fixture = world.serialize();
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html')));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await click('#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(fixture))}],'review.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for('!document.querySelector("#load-dialog").open&&genesis.snapshot().name==="Readable individual lives"', 'fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await js('document.querySelector("#menu-paint").click()');
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Resume time');
        await delay(3500); await fit();
        const before = await js('JSON.stringify(genesis.snapshot())');
        await select('person', first.id);
        await click('[data-detail="citizen"] > summary');
        await js('document.querySelector("#entity-card").scrollTop=300');
        const scroll = await js('document.querySelector("#entity-card").scrollTop'); assert.ok(scroll > 100);
        await delay(1100);
        assert.ok(Math.abs(await js('document.querySelector("#entity-card").scrollTop') - scroll) <= 1);
        assert.equal(await js('document.querySelector("[data-detail=citizen]").open'), true);
        assert.ok(await js(`(()=>{const card=document.querySelector('#entity-card').getBoundingClientRect(),
            close=document.querySelector('[data-action=close-creature]').getBoundingClientRect();
            return close.top>=card.top&&close.bottom<=card.bottom;})()`));
        await screenshot('sticky-heading-1366x768');
        await select('person', second.id);
        assert.equal(await js('document.querySelector("#entity-card").scrollTop'), 0);
        assert.equal(await js('document.querySelector("[data-detail=citizen]").open'), false);
        await click('[data-detail="citizen"] > summary'); await js('document.querySelector("#entity-card").scrollTop=300');
        await click('[data-action="close-creature"]'); await select('person', second.id);
        assert.equal(await js('document.querySelector("#entity-card").scrollTop'), 0);
        checks.push('Same-identity refresh preserves deep scroll/details; new and reopened identities reset to the top; sticky native close stays reachable');
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(250); await fit(); await select('person', child.id);
            assert.ok(await js(`(()=>{const card=document.querySelector('#entity-card'),n=card.querySelector('.entity-needs'),
                r=n.getBoundingClientRect(),c=card.getBoundingClientRect();return !n.closest('details')
                    &&r.top>=c.top&&r.bottom<=c.bottom&&n.textContent.includes('Hunger · 20/100')
                    &&n.textContent.includes('Energy · 70/100')&&n.textContent.includes('Diet · Omnivore')
                    &&card.querySelectorAll('meter[aria-label=Hunger]').length===1;})()`));
            assert.equal(await js(`[...document.querySelectorAll('#entity-card .entity-row')].find(row=>row.firstElementChild.textContent==='Role').lastElementChild.textContent`), 'Child');
            assert.ok(await js('document.querySelector(".entity-activity").textContent.match(/Learning|Returning home|Resting at home|Socializing/)'));
            await screenshot(`child-needs-${width}x768`);
            await click('[data-detail="citizen"] > summary');
            assert.ok(await js('document.querySelector("#entity-card").textContent.includes("farmer · adult work begins at 18")'));
            assert.equal(await js('document.querySelector(".character-profile").querySelectorAll(".character-need").length'), 0);
            await key('Escape'); await select('person', newborn.id);
            assert.equal(await js(`[...document.querySelectorAll('#entity-card .entity-row')].find(row=>row.firstElementChild.textContent==='Role').lastElementChild.textContent`), 'Child');
        }
        await key('Escape'); await fit(); await select('animal', wolf.id);
        assert.equal(await js('document.querySelectorAll(".entity-needs meter").length'), 2);
        await key('Escape'); await select('animal', angel.id);
        assert.equal(await js('document.querySelectorAll(".entity-needs meter").length'), 0);
        assert.ok(await js('document.querySelector(".entity-needs").textContent.includes("ordinary hunger does not apply")'));
        checks.push('Collapsed primary needs fit1024/1366 without duplicate deep gauges; ages0/4 show Child with honest future aptitude; wildlife and supernatural needs remain distinct');
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(250); await fit(); await select('person', first.id);
            await click('[data-action="zoom-creature"]'); await wait_for('Math.abs(genesis.camera().zoom-12)<.01', 'creature focus');
            await js('document.querySelector("#zoom-slider").value="100";document.querySelector("#zoom-slider").dispatchEvent(new Event("input"))');
            await delay(200);
            assert.ok(Math.abs(await js('genesis.camera().zoom') - 24) < 0.000001);
            const camera = await js('genesis.camera()');
            const anchor = await js(`(()=>{const c=genesis.camera(),p=genesis.snapshot().people.find(p=>p.id===${first.id});
                return{x:c.origin.x+p.x*6*c.base*c.zoom,y:c.origin.y+p.y*6*c.base*c.zoom};})()`);
            assert.ok(anchor.x>=0&&anchor.x<=camera.width&&anchor.y>=0&&anchor.y<=camera.height);
            await select('person', first.id); assert.deepEqual(await js('genesis.camera()'), camera);
            assert.ok(await js('genesis.visibility().creature_pixel_scale<=2.200001&&genesis.visibility().vehicle_pixel_scale<=1.680001'));
            assert.equal(await js('JSON.stringify(genesis.snapshot())'), before, 'Inspector and capped artwork must be read-only at maximum camera zoom');
            await screenshot(`extreme-zoom-${width}x768`);
        }
        checks.push('Maximum24x camera zoom keeps saved anchors/selectability while bounding sprite/equipment growth; paused snapshot remains exact at1024/1366');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
