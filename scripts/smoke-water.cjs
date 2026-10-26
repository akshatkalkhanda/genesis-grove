const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-water-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'water');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    const errors = [], checks = [];
    win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message);
    });
    const js = code => win.webContents.executeJavaScript(code, true);
    const wait_for = async (condition, label, timeout = 15000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
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
        const world = new World({ preset: 'empty', inhabited: false, seed: 'visible-water-service',
            name: 'A thirsty resident at a working well' });
        world.tiles.fill(T.GRASS);
        const kingdom = world.found_village(48, 48);
        kingdom.houses = [{ x: 48, y: 48 }];
        kingdom.buildings.push({ type: 'well', x: 48, y: 48, growth: 0, harvests: 0, water_stock: 3 });
        world.add_person(48, 48, kingdom.id);
        const person = world.people[0];
        person.x = 48.9; person.y = 48.9;
        person.needs.hydration = 0;
        person.needs.nutrition = 100;
        person.needs.energy = 100;
        person.needs.decision_timer = 0;
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
            dt.items.add(new File([${JSON.stringify(JSON.stringify(fixture))}], 'water-fixture.json',
            {type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for(`!document.querySelector('#load-dialog').open&&genesis.snapshot().name===`
            + JSON.stringify(world.name), 'water fixture import');
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-paint');
        await js('document.querySelector("#zoom-reset").click()');
        const initial = await js('genesis.snapshot()');
        assert.equal(initial.people[0].needs.hydration, 0);
        assert.equal(initial.villages[0].buildings.find(b=>b.type==="well").water_stock, 3);
        if (!await js('document.querySelector("#start-screen").hidden')) await click('#menu-start');
        else if (await js('document.querySelector("#pause").getAttribute("aria-label")==="Resume time"')) await click('#pause');
        await wait_for(`genesis.snapshot().villages[0].buildings.find(b=>b.type==='well').water_stock<3
            &&genesis.snapshot().people[0].needs.hydration>0`, 'resident drinks from the well tile and rehydrates', 5000);
        const running = await js('genesis.snapshot()');
        assert.equal(running.people[0].water_carried, 1, 'the finite well filled a real carried ration');
        await click('#pause');
        await wait_for(`document.querySelector('#pause').getAttribute('aria-label')==='Resume time'`, 'simulation pause');
        const frozen = JSON.stringify(await js('genesis.snapshot()'));
        await delay(500);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), frozen,
            'water stock and hydration remain unchanged while paused');
        checks.push('A resident at the well-tile corner drinks finite water and gains hydration');

        const moving = running.people[0];
        const point = await js(`(()=>{const c=genesis.camera(),r=document.querySelector('#world').getBoundingClientRect(),s=6*c.base*c.zoom;
            return{x:r.x+c.origin.x+(${moving.x}+.5)*s,y:r.y+c.origin.y+(${moving.y}+.5)*s}})()`);
        win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
        win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
        await wait_for(`!document.querySelector('#entity-card').hidden`, 'resident inspector');
        const inspector = await js('document.querySelector("#entity-card").textContent');
        assert.match(inspector, /Thirst/);
        assert.match(inspector, /Carried water/);
        await screenshot('resident-water-inspector');
        checks.push('Citizen inspector reports thirst and carried water');

        await click('#diplomacy');
        await js(`(()=>{const d=[...document.querySelectorAll('#kingdom-profile details')]
            .find(item=>item.textContent.includes('Living conditions & public services'));if(d)d.open=true})()`);
        const services = await js('document.querySelector("#kingdom-profile").textContent');
        assert.match(services, /Water/);
        assert.match(services, /thirsty/);
        assert.match(services, /well rations/);
        assert.match(services, /freshwater ponds/);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), frozen,
            'opening panels does not advance or otherwise alter the paused water state');
        for (const width of [1024, 1366]) {
            win.setSize(width, 768); await delay(250);
            const fits = await js(`(()=>{const r=document.querySelector('#diplomacy-dialog').getBoundingClientRect();
                return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight
                    &&document.documentElement.scrollWidth<=innerWidth})()`);
            assert.equal(fits, true, `kingdom water details fit ${width}x768`);
            await screenshot(`kingdom-water-${width}`);
        }
        checks.push('Kingdom services panel reports measured water access and thirst at compact and desktop sizes');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        try {
            console.error('Failure state', await js(`(()=>{const s=genesis.snapshot(),p=s.people[0],v=s.villages[0];
                return{time:s.time,tick:s.tick,people:s.people.map(x=>({id:x.id,health:x.health,x:x.x,y:x.y,
                    hydration:x.needs?.hydration,water_carried:x.water_carried,action:x.current_action,task:x.task})),
                    wells:v?.buildings.filter(b=>b.type==='well').map(b=>({x:b.x,y:b.y,stock:b.water_stock})),
                    paused:document.querySelector('#pause').getAttribute('aria-label')}})()`));
        } catch {}
        await screenshot('failure');
        console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
