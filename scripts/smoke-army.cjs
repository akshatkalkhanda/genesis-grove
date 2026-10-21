const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-army-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'army-inspector');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    const errors = [], checks = [];
    win.webContents.on('console-message', details => {
        if (details.level === 'error') errors.push(details.message);
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
        const e=document.querySelector(${JSON.stringify(selector)});
        e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();
        return {x:r.x+r.width/2,y:r.y+r.height/2};})()`));
    const key = async code => {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: code });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: code });
        await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    const load_world = async save => {
        await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(save))}],'army.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open && genesis.snapshot().name===${JSON.stringify(save.name)}`, 'world import');
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-start');
        await delay(200);
        if (!await js('document.querySelector("#pause").textContent.includes("Resume")')) await click('#pause');
    };
    let home_id;
    const badge = async () => js(`(()=>{
        const w=genesis.snapshot(),ps=w.people.filter(p=>p.village_id===${home_id}&&p.role==='soldier'&&!p.recovering),
        c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect();
        return {x:r.x+c.origin.x+ps.reduce((n,p)=>n+p.x,0)/ps.length*6*c.base*c.zoom,
            y:r.y+c.origin.y+ps.reduce((n,p)=>n+p.y,0)/ps.length*6*c.base*c.zoom-18};})()`);
    const select_army = async () => {
        await point_click(await badge());
        await wait_for(`document.querySelector('[data-action="close-army"]') && !document.querySelector('#entity-card').hidden`, 'army selection');
    };
    try {
        const { World, T } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'simulation.js')).href);
        const world = new World({ preset: 'empty', inhabited: false, seed: 'army-native', name: 'Army inspector native checks' });
        world.tiles.fill(T.GRASS); world.laws.diplomacy = false; world.laws.rebellions = false;
        world.laws.expansion = false; world.laws.natural_events = false;
        const home = world.found_village(48, 64), enemy = world.found_village(144, 64);
        home_id = home.id;
        for (const site of [home, enemy]) {
            site.food = 300;
            for (let index = 0; index < (site === home ? 8 : 4); index++) {
                world.add_person(site.x + index * 0.25, site.y + index % 2, site.id);
                const person = world.people.at(-1); person.role = 'soldier'; person.task = 'Guarding';
                person.weapon_level = index % 3; person.armor_level = index % 2;
            }
        }
        world.add_animal(88, 45, 'deer');
        world.set_relation(home.id, enemy.id, 'war');
        world.plan_armies(new Map([[home.id, new Set([enemy.id])], [enemy.id, new Set([home.id])]]));
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        const game_index = process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html'));
        await win.loadFile(game_index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await load_world(world.serialize());
        await delay(3400); // Let the import toast clear before documentation captures.
        const before = await js('JSON.stringify(genesis.snapshot())');
        const camera_before = await js('genesis.camera()');
        await select_army();
        assert.deepEqual(await js('genesis.camera()'), camera_before, 'Selection does not move camera');
        assert.equal(await js('document.body.classList.contains("info-open")'), false);
        const text = await js('document.querySelector("#entity-card").textContent');
        assert.ok(text.includes('8 active soldiers') && text.includes(enemy.name) && text.includes('Shared food'));
        assert.ok(text.includes('Strength (sum)') && text.includes('no separate supply stock'));
        assert.ok(text.includes('Order') && text.includes('March') && text.includes('Keeping the selected reachable enemy town'));
        await screenshot('army-1366x768');
        await click('#entity-card details summary');
        await delay(650);
        assert.ok(await js('document.querySelector("#entity-card details").open'));
        assert.equal(await js('document.activeElement.tagName'), 'SUMMARY');
        await js(`(()=>{const row=[...document.querySelectorAll('#entity-card .entity-row')].find(e=>e.firstElementChild.textContent==='Weapons');row.scrollIntoView({block:'start'})})()`);
        await delay(150);
        assert.ok(await js(`(()=>{const card=document.querySelector('#entity-card').getBoundingClientRect(),
            row=[...document.querySelectorAll('#entity-card .entity-row')].find(e=>e.firstElementChild.textContent==='Weapons').getBoundingClientRect();
            return row.top>=card.top&&row.bottom<=card.bottom})()`));
        await screenshot('army-equipment-1366x768');
        await click('[data-action="follow-army"]');
        assert.equal(await js('document.querySelector("[data-action=follow-army]").getAttribute("aria-pressed")'), 'true');
        await key('D'); await delay(550);
        assert.equal(await js('document.querySelector("[data-action=follow-army]").getAttribute("aria-pressed")'), 'false');
        await click('[data-action="focus-army"]');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before, 'Inspector actions do not paint or mutate simulation');
        checks.push('Native badge selection, stable camera, gear/member/shared-food data, persistent details/focus, follow cancellation and no paint-through');
        for (const width of [1024, 1366]) {
            win.setSize(width, 768); await delay(300);
            assert.ok(await js(`(()=>{const r=document.querySelector('#entity-card').getBoundingClientRect();
                return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight
                    &&document.documentElement.scrollWidth<=innerWidth})()`));
            assert.ok(await js(`['close-army','focus-army','follow-army'].every(action=>{
                const e=document.querySelector('[data-action='+action+']');e.scrollIntoView({block:'nearest'});
                const r=e.getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#entity-card')})`));
            await click('#entity-card details summary');
            await screenshot(`army-${width}x768-compact`);
        }
        checks.push('Inspector and close/focus/follow remain reachable at 1024x768 and 1366x768');
        await key('F8');
        assert.equal(await js('getComputedStyle(document.querySelector("#entity-card")).display'), 'none');
        await screenshot('army-presentation');
        await key('Escape');
        assert.equal(await js('document.body.classList.contains("presentation")'), false);
        await key('Escape');
        assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        await screenshot('army-idle');
        await click('#zoom-reset'); await select_army();
        await click('[data-action="close-army"]');
        assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        checks.push('Native close, Escape, View/F8 hide/restore and clean idle view');
        await select_army();
        await click('#diplomacy');
        await js(`document.querySelector('#source-kingdom').value='${home.id}';document.querySelector('#source-kingdom').dispatchEvent(new Event('change'));document.querySelector('#target-kingdom').value='${enemy.id}';document.querySelector('#target-kingdom').dispatchEvent(new Event('change'))`);
        await click('[data-relation="peace"]');
        await click('#diplomacy-dialog [data-close]');
        await delay(600);
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("Changed · awaiting new plan")'));
        await click('#pause'); await delay(250); await click('#pause'); await delay(600);
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("No enemy target")'));
        await key('Escape');
        await click('#map-layers summary'); await click('[name="map-layer"][value="armies"]');
        await select_army();
        checks.push('Changed target invalidated on peace; home garrison remains selectable in Armies layer');
        const saved = await js('genesis.snapshot()');
        await load_world(saved);
        assert.equal(await js('document.querySelector("#entity-card").hidden'), true);
        await select_army();
        checks.push('Existing JSON save roundtrip rebuilds army data and clears old selection');
        const withdrawal = World.deserialize(saved); withdrawal.name = 'Autonomous withdrawal';
        withdrawal.set_relation(home.id, enemy.id, 'war');
        for (const person of withdrawal.people.filter(person => person.village_id === home.id)) person.x += 20;
        withdrawal.villages.find(site => site.id === home.id).food = 2;
        withdrawal.plan_armies(new Map([[home.id, new Set([enemy.id])], [enemy.id, new Set([home.id])]]));
        await load_world(withdrawal.serialize()); await select_army();
        const retreat_text = await js('document.querySelector("#entity-card").textContent');
        assert.ok(retreat_text.includes('Retreat') && retreat_text.includes('Shared kingdom food is low'));
        await screenshot('army-withdrawal-1366x768');
        const withdrawal_before = await js(`genesis.snapshot().people.filter(p=>p.village_id===${home.id}).map(p=>p.x)`);
        await click('#pause'); await delay(350); await click('#pause');
        const withdrawal_after = await js(`genesis.snapshot().people.filter(p=>p.village_id===${home.id}).map(p=>p.x)`);
        assert.ok(withdrawal_after.every((x, index) => x < withdrawal_before[index]), 'Saved retreat actually moves soldiers home');
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("retreating")'));
        checks.push('Saved order and short reason display; food withdrawal really moves members home');
        // Infection naturally removes every soldier from this garrison, via recovery or death.
        const sick = World.deserialize(saved); sick.name = 'Dispersing garrison';
        for (const person of sick.people.filter(p => p.village_id === home.id)) {
            person.infection = 1; person.health = 40;
        }
        await load_world(sick.serialize()); await select_army();
        await click('[data-action="follow-army"]');
        await key('4');
        await wait_for('document.querySelector("#entity-card").hidden', 'dispersed garrison clears inspector');
        await click('#pause');
        checks.push('Garrison recovery/death safely clears selection and follow while simulation runs');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
