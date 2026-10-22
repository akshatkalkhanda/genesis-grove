const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-king-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'king-inspector');
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
    try {
        const { World, T } = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'simulation.js')).href);
        const world = new World({ preset: 'empty', inhabited: false, seed: 'royal-native', name: 'Royal succession' });
        world.tiles.fill(T.GRASS);
        for (const key of Object.keys(world.laws)) world.laws[key] = false;
        for (let i = 0; i < 5; i++) world.add_person(80 + i, 64);
        const kingdom = world.villages[0], king = world.people[0], heir = world.people[1];
        king.name = 'Ari the Founder'; heir.name = 'Rowan the Heir';
        king.age = 55 * world.year_length; heir.age = 25 * world.year_length;
        heir.parents = [{ id: king.id, name: king.name }];
        kingdom.food = 1000;
        const index = process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html')
            : path.join(__dirname, '..', 'index.html');
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await load_world(world.serialize()); await delay(3400);
        const before = await js('JSON.stringify(genesis.snapshot())');
        const open_kingdom = async () => {
            if (!await js('document.body.classList.contains("info-open")')) await click('#world-info');
            await click('#civilizations button');
            await wait_for('document.querySelector(".royal-house")', 'royal household');
        };
        await open_kingdom();
        let text = await js('document.querySelector(".royal-house").textContent');
        assert.ok(text.includes(king.name) && text.includes(heir.name) && text.includes('adult child') && text.includes('Year 1'));
        await screenshot('kingdom-royal-house');
        await click('[data-action="inspect-king"]');
        await wait_for('!document.querySelector("#entity-card").hidden', 'king inspector');
        text = await js('document.querySelector("#entity-card").textContent');
        assert.ok(text.includes('♛ King') && text.includes(king.name) && text.includes(heir.name) && text.includes('Royal policy'));
        assert.equal(await js('document.body.classList.contains("info-open")'), false);
        await screenshot('king-profile-1366');
        await click('[data-action="follow-creature"]');
        assert.equal(await js('document.querySelector("[data-action=follow-creature]").getAttribute("aria-pressed")'), 'true');
        await key('D'); await delay(550);
        assert.equal(await js('document.querySelector("[data-action=follow-creature]").getAttribute("aria-pressed")'), 'false');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), before);
        checks.push('King, adult heir and reign shown; king selection and following do not mutate paused world');
        await click('[data-action="close-creature"]');
        await open_kingdom(); await click('[data-action="inspect-heir"]');
        assert.ok(await js('document.querySelector("#entity-card .entity-heading").textContent.includes("Rowan the Heir")'));
        for (const width of [1024, 1366]) {
            win.setSize(width, 768); await delay(250);
            await click('[data-action="close-creature"]'); await open_kingdom();
            await screenshot(`royal-house-${width}`);
            await click('[data-action="inspect-king"]');
            assert.ok(await js(`(()=>{const r=document.querySelector('#entity-card').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()`));
            await screenshot(`king-profile-${width}`);
        }
        checks.push('Both royal links and compact profile remain usable at 1024 and 1366 pixels');
        const successor = World.deserialize(world.serialize());
        successor.name = 'The second reign'; successor.people[0].health = 0;
        successor.time = 10 * successor.year_length; successor.clean_up();
        await load_world(successor.serialize()); await delay(3400); await open_kingdom();
        assert.ok(await js('document.querySelector(".royal-house").textContent.includes("Rowan the Heir") && document.querySelector(".royal-house").textContent.includes("Year 11")'));
        await click('[data-action="inspect-king"]');
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("Rowan the Heir") && document.querySelector("#entity-card").textContent.includes("♛ King")'));
        await screenshot('inherited-crown');
        checks.push('Saved death and inheritance show the successor and new reign after import');
        const vacant = World.deserialize(successor.serialize()); vacant.name = 'Awaiting adulthood';
        for (const person of vacant.people) person.age = vacant.year_length * 10;
        vacant.clean_up(); await load_world(vacant.serialize()); await open_kingdom();
        assert.ok(await js('document.querySelector(".royal-house").textContent.includes("Crown vacant") && !document.querySelector("[data-action=inspect-king]")'));
        checks.push('A child-only kingdom clearly shows a vacant crown without a broken inspection button');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
