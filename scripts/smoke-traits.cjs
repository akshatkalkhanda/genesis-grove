const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-trait-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'traits');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    if (process.argv.includes('--visible')) win.showInactive();
    const errors = [], checks = [], timings = {};
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
    const escape = async () => {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' }); await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    const load_world = async save => {
        await click(await js('document.querySelector("#start-screen").hidden') ? '#load' : '#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(save))}],'traits.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open && genesis.snapshot().name===${JSON.stringify(save.name)}`, 'fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await js('document.querySelector("#menu-paint").click()');
        assert.equal(await js(`document.querySelector('#pause').getAttribute('aria-label')`), 'Resume time');
        await js('document.querySelector("#zoom-reset").click()'); await delay(3500);
    };
    const select = async (kind, id) => {
        await point_click(await js(`(()=>{const w=genesis.snapshot(),unit=w.${kind === 'person' ? 'people' : 'animals'}.find(u=>u.id===${id}),
            c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect();
            return{x:r.x+c.origin.x+unit.x*6*c.base*c.zoom,y:r.y+c.origin.y+unit.y*6*c.base*c.zoom};})()`));
        await wait_for(`!document.querySelector('#entity-card').hidden&&document.querySelector('#entity-card').textContent.includes('#${id}')`, 'creature selection');
    };
    const open_editor = async () => {
        if (!await js('document.querySelector("#entity-card [data-detail=citizen]").open')) await click('#entity-card [data-detail="citizen"] > summary');
        await click('[data-action="edit-character"]');
        await wait_for('document.querySelector("#character-dialog").open', 'character editor');
    };
    try {
        const { World, T } = await import_src('simulation.js');
        const { TRAIT_CATALOG } = await import_src('character_traits.js');
        const { add_food } = await import_src('diets.js');
        const world = new World({ preset: 'empty', inhabited: false, seed: 'phase-one-native', name: 'Individual life checks' });
        world.tiles.fill(T.GRASS); world.laws.diplomacy = false; world.laws.expansion = false;
        world.laws.rebellions = false; world.laws.natural_events = false;
        const home = world.found_village(60, 64); home.food = 0; home.food_stores = {}; add_food(home, 'plant', 30);
        world.add_person(60, 64, home.id); world.add_person(72, 64, home.id);
        const [person, partner] = world.people;
        home.king_id = partner.id;
        person.trait = 'brave'; partner.trait = 'careful'; person.trait_ids = []; partner.trait_ids = [];
        person.partner_id = partner.id; partner.partner_id = person.id;
        person.diet_id = partner.diet_id = 'omnivore';
        person.needs = { nutrition: 80, energy: 70, decision_timer: 0, resting: false, intent: null };
        person.current_action = 'Exploring'; person.action_reason = 'Nutrition and energy are sufficient.';
        person.recent_events = [{ time: 0, text: 'Entered the world.' }];
        world.add_animal(90, 48, 'wolf');
        const animal = world.animals[0];
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        await win.loadFile(process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html')));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await load_world(world.serialize()); await select('person', person.id);
        const before = await js('JSON.stringify(genesis.snapshot())');
        assert.ok(await js('document.querySelector(".entity-activity").textContent.includes("Nutrition and energy are sufficient.")'));
        const closed_height = await js('document.querySelector("#entity-card").getBoundingClientRect().height');
        await open_editor();
        assert.equal(await js('document.querySelectorAll("[data-trait-id]").length'), TRAIT_CATALOG.length);
        assert.equal(TRAIT_CATALOG.length, 14);
        await click('[data-character-tab="diet"]');
        assert.equal(await js('document.querySelectorAll("[name=character-diet]").length'), 3);
        await click('[name="character-diet"][value="herbivore"]'); await escape();
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before, 'Open/cancel and an unapplied diet choice must be read-only');
        assert.equal(await js('document.querySelector("#entity-card").getBoundingClientRect().height'), closed_height);
        assert.ok(await js('document.querySelector(".entity-needs").textContent.includes("Hunger · 20/100")'));
        assert.ok(await js('document.querySelector(".entity-needs").textContent.includes("Energy · 70/100")'));
        assert.ok(await js('document.querySelector(".character-events").textContent.includes("Entered the world.")'));
        checks.push('Existing primary trait, current action/reason, needs/history details,14traits/3diets and read-only opening/cancel');
        const strength = () => js(`Number([...document.querySelectorAll('#entity-card .entity-row')].find(row=>row.firstElementChild.textContent==='Strength / Intelligence').lastElementChild.textContent.split('/')[0])`);
        const base_strength = await strength();
        await open_editor();
        await click('[data-trait-action="strong"]'); assert.equal(await strength(), base_strength + 4);
        await click('[data-trait-action="weak"]'); assert.equal(await strength(), base_strength - 4);
        let edited = await js(`genesis.snapshot().people.find(p=>p.id===${person.id})`);
        assert.ok(edited.trait_ids.includes('weak') && !edited.trait_ids.includes('strong'));
        assert.equal(edited.trait, 'brave');
        assert.ok(await js('document.querySelector("#character-status").textContent.includes("Removed conflicting Strong")'));
        await click('[data-trait-action="lucky"]'); await click('[data-trait-action="unlucky"]');
        await click('[data-character-tab="diet"]'); await click('[name="character-diet"][value="herbivore"]');
        await click('#character-apply-diet');
        edited = await js(`genesis.snapshot().people.find(p=>p.id===${person.id})`);
        assert.equal(edited.diet_id, 'herbivore');
        assert.ok(edited.trait_ids.includes('unlucky') && !edited.trait_ids.includes('lucky'));
        assert.ok(edited.trait_ids.length <= 12);
        checks.push('Explicit grants remove conflicting traits immediately, preserve primary trait and apply a strict herbivore diet');
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(200);
            for (const tab of ['traits', 'diet']) {
                await click(`[data-character-tab="${tab}"]`);
                assert.ok(await js(`(()=>{const d=document.querySelector('#character-dialog').getBoundingClientRect(),
                    s=document.querySelector('.character-catalog-scroll').getBoundingClientRect(),
                    footer=document.querySelector('.character-dialog-footer').getBoundingClientRect();
                    return d.left>=0&&d.right<=innerWidth&&d.top>=0&&d.bottom<=innerHeight
                        &&s.bottom<=footer.top&&footer.bottom<=d.bottom
                        &&document.documentElement.scrollWidth<=innerWidth})()`));
                await screenshot(`${tab}-${width}x768`);
            }
        }
        await click('[data-character-tab="traits"]');
        for (const trait of TRAIT_CATALOG) {
            if (!await js(`document.querySelector('[data-trait-action="${trait.id}"]').getAttribute('aria-pressed')==='true'`)) {
                await click(`[data-trait-action="${trait.id}"]`);
            }
        }
        await escape();
        assert.ok(await js(`(()=>{const chips=document.querySelector('.character-chips'),r=chips.getBoundingClientRect(),
            cs=[...chips.children].map(e=>e.getBoundingClientRect());return cs.length<=12&&cs.length>1
                &&cs.every(c=>c.left>=r.left&&c.right<=r.right)&&new Set(cs.map(c=>c.top)).size>1})()`));
        await js('document.querySelector(".character-profile").scrollIntoView({block:"start"})'); await delay(150);
        await screenshot('trait-details-1024x768');
        const saved = await js('genesis.snapshot()');
        await load_world(saved);
        assert.deepEqual(await js('genesis.snapshot()'), saved, 'JSON roundtrip preserves explicit edits and paused individual state');
        await select('person', person.id); await open_editor();
        const stale_before = await js('JSON.stringify(genesis.snapshot())');
        // Existing family navigation changes selection while the editor still targets its original unit.
        await js(`document.querySelector('[data-action="relative-${partner.id}"]').click();document.querySelector('[data-trait-action="strong"]').click()`);
        await wait_for('!document.querySelector("#character-dialog").open', 'stale editor closes');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), stale_before, 'A stale editor must change neither creature');
        await select('animal', animal.id);
        const animal_before = await js('JSON.stringify(genesis.snapshot())');
        await open_editor(); await escape();
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), animal_before);
        checks.push('1366/1024bounded dialogs, exact saved edits, stale-selection rejection and read-only animal inspection');
        assert.equal(await js(`document.querySelector('#pause').getAttribute('aria-label')`), 'Resume time');
        const paused_before = await js('JSON.stringify(genesis.snapshot())');
        await delay(600);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), paused_before,
            'The actual app loop must preserve exact world and needs state while paused');
        const first = await js('genesis.snapshot()');
        await click('[data-speed="1"]'); await delay(2000); await click('#pause');
        const one_x = await js('genesis.snapshot()');
        const one_x_seconds = one_x.time - first.time;
        const first_person = first.people.find(unit => unit.id === person.id);
        const one_x_person = one_x.people.find(unit => unit.id === person.id);
        assert.ok(one_x_seconds >= 1.6 && one_x_seconds <= 2.8, `1x advanced ${one_x_seconds} simulation seconds`);
        assert.ok(one_x_person.age > first_person.age, 'Actual app steps advance age at1x');
        assert.notEqual(one_x_person.needs.nutrition, first_person.needs.nutrition,
            'Actual app steps advance hunger nutrition at1x');
        await click('[data-speed="20"]'); await delay(2000); await click('#pause');
        const twenty_x = await js('genesis.snapshot()');
        const twenty_x_seconds = twenty_x.time - one_x.time;
        const ratio = twenty_x_seconds / one_x_seconds;
        assert.ok(twenty_x_seconds >= 32 && twenty_x_seconds <= 48, `20x advanced ${twenty_x_seconds} simulation seconds`);
        assert.ok(ratio >= 15 && ratio <= 25, `Actual speed ratio was ${ratio}`);
        assert.ok(twenty_x.people.find(unit => unit.id === person.id).age > one_x_person.age,
            'Actual app steps continue age advancement at20x');
        assert.doesNotThrow(() => World.deserialize(twenty_x), 'The advanced app world remains a valid save');
        const paused_after = await js('JSON.stringify(genesis.snapshot())');
        await delay(600); assert.equal(await js('JSON.stringify(genesis.snapshot())'), paused_after);
        Object.assign(timings, { one_x_seconds, twenty_x_seconds, ratio });
        checks.push('Actual app loop preserves paused state, advances hunger/age at1x and20x with bounded timing ratio, and saves valid state');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors, timings }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors, timings }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
