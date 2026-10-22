const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-zoom-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'zoom-camera');
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
        const world = new World({ preset: 'empty', inhabited: false, seed: 'zoom-native', name: 'Zoom and visibility' });
        world.tiles.fill(T.GRASS); world.lighting.phase = .5;
        for (const key of Object.keys(world.laws)) world.laws[key] = false;
        const home = world.found_village(96, 64); home.food = 10000; home.research_level = 5;
        for (let i = 0; i < 72; i++) {
            world.add_person(91 + i % 12, 62 + Math.floor(i / 12), home.id);
            world.people.at(-1).weapon_level = 5;
        }
        for (let i = 0; i < 36; i++) home.houses.push({ x: 89 + i % 9 * 2, y: 59 + Math.floor(i / 9) * 2 });
        for (let i = 0; i < 8; i++) home.buildings.push({ type: i % 2 ? 'farm' : 'windmill', x: 90 + i * 2, y: 72, growth: 0, harvests: 0 });
        world.revision++;
        const game_index = process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html')
            : path.join(__dirname, '..', 'index.html');
        await win.loadFile(game_index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await load_world(world.serialize()); await delay(3400);
        const before = await js('JSON.stringify(genesis.snapshot())');
        const set_zoom = async zoom => {
            await js(`(()=>{const e=document.querySelector('#zoom-slider');e.value=String(Math.log(${zoom}/.65)/Math.log(24/.65)*100);e.dispatchEvent(new Event('input'))})()`);
            await delay(120);
        };
        const camera = () => js('genesis.camera()');
        const world_point = (c, p) => ({ x: (p.x - c.origin.x)/(6*c.base*c.zoom), y: (p.y-c.origin.y)/(6*c.base*c.zoom) });
        const close_to = (a,b,label) => assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1, label);
        const rect = await js('(()=>{const r=document.querySelector("#world").getBoundingClientRect();return {x:r.x,y:r.y}})()');
        const focal = { x: 420, y: 330 };
        const anchored = world_point(await camera(), focal);
        win.webContents.sendInputEvent({ type: 'mouseWheel', x:focal.x+rect.x, y:focal.y+rect.y, deltaY: 110, deltaX:0, canScroll:true });
        await delay(450);
        const after_wheel = await camera();
        assert.ok(after_wheel.zoom > 1, `wheel zoom: ${after_wheel.zoom}`);
        const after_anchor = world_point(after_wheel,focal);
        close_to({x:anchored.x*6*after_wheel.base*after_wheel.zoom,y:anchored.y*6*after_wheel.base*after_wheel.zoom},
            {x:after_anchor.x*6*after_wheel.base*after_wheel.zoom,y:after_anchor.y*6*after_wheel.base*after_wheel.zoom},'wheel anchor drift under one CSS pixel');
        await click('#zoom-in'); await click('#zoom-reset'); await delay(450);
        assert.equal((await camera()).zoom,1);
        checks.push('Native wheel retains off-center landmark; Fit interrupts pending animated zoom');

        win.webContents.debugger.attach('1.3');
        await click('#zoom-reset');
        const motion_anchor = world_point(await camera(),focal);
        win.webContents.sendInputEvent({ type:'mouseWheel',x:focal.x+rect.x,y:focal.y+rect.y,deltaY:110,deltaX:0,canScroll:true });
        await delay(25);
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] });
        await delay(120);
        const reduced = await camera(), reduced_anchor = world_point(reduced,focal);
        close_to({x:motion_anchor.x*6*reduced.base*reduced.zoom,y:motion_anchor.y*6*reduced.base*reduced.zoom},
            {x:reduced_anchor.x*6*reduced.base*reduced.zoom,y:reduced_anchor.y*6*reduced.base*reduced.zoom},'reduced-motion switch preserves anchor');
        const reduced_zoom = reduced.zoom; await delay(120);assert.equal((await camera()).zoom,reduced_zoom);
        await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {features:[]});
        await click('#zoom-reset');
        checks.push('Changing reduced-motion preference settles in-flight zoom at its original anchor');
        const touch = (type,points) => win.webContents.debugger.sendCommand('Input.dispatchTouchEvent', {
            type, touchPoints: points.map(([id,x,y])=>({id,x:x+rect.x,y:y+rect.y,radiusX:2,radiusY:2,force:1}))
        });
        const pinch = async (editing = false, cancel = false) => {
            await touch('touchStart',[[1,400,170]]);
            await touch('touchMove',[[1,410,175]]);
            await touch('touchStart',[[1,410,175],[2,600,175]]);
            for(let i=1;i<=15;i++) {
                await touch('touchMove',[[1,410-i*5,175+i],[2,600+i*5,175+i]]);
                await delay(12);
            }
            if(cancel) await touch('touchCancel',[]);
            else { await touch('touchEnd',[[1,335,190]]); await touch('touchEnd',[]); }
            await delay(120);
        };
        await pinch();
        assert.ok((await camera()).zoom>1.5);
        assert.equal(await js('document.querySelector("#entity-card").hidden'),true);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),before);
        checks.push('Real Chromium two-touch pinch scales/pans without selecting or changing the world');
        await click('[data-category="terrain"]'); await click('[data-tool="sand"]');
        // Keep the terrain brush active; all touch points are above the open catalog.
        const edit_before = await js('JSON.stringify(genesis.snapshot())');
        await pinch(true); await pinch(true,true);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),edit_before,'pinch with active brush cannot paint');
        await touch('touchStart',[[1,460,220]]); await touch('touchMove',[[1,500,240]]);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),edit_before,'touch stroke is preview only until lift');
        await touch('touchCancel',[]);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),edit_before);
        await touch('touchStart',[[1,460,220]]); await touch('touchMove',[[1,500,240]]); await touch('touchEnd',[]);
        assert.notEqual(await js('JSON.stringify(genesis.snapshot())'),edit_before,'one-finger brush commits on lift');
        await click('#observe'); win.webContents.debugger.detach();
        await load_world(world.serialize()); await delay(3400);
        checks.push('Active brush pinch and cancelled strokes preserve exact save; single-finger stroke commits on lift');
        const clean = await js('JSON.stringify(genesis.snapshot())');
        for(const width of [1366,1024]) {
            win.setSize(width,768); await delay(200);
            for(const [zoom,level] of [[1,'world'],[3,'town'],[10,'citizen']]) {
                await click('#zoom-reset'); await set_zoom(zoom);
                const v = await js('genesis.visibility()');
                assert.equal(v.level,level);
                assert.ok(v.names<=6 && v.activities<=24 && v.settlements<=10);
                if(level==='world') assert.equal(v.houses+v.facilities+v.people+v.names+v.activities,0);
                else assert.ok(v.houses>0 && v.facilities>0 && v.people>0);
                const controls=await js('(()=>{const r=document.querySelector(".zoom-controls").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()');
                assert.ok(controls.x>=0&&controls.x+controls.width<=width);
                await screenshot(`zoom-${level}-${width}`);
            }
        }
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),clean);
        checks.push('World/town/citizen visibility budgets and usable fixed controls at 1024 and 1366; saves unchanged');
        await click('#zoom-reset');
        await js(`document.querySelector('#world-info').click();document.querySelector('#civilizations button').click()`);
        await click('[data-action="inspect-king"]');
        assert.ok(await js('document.querySelector("#entity-card").textContent.includes("♛ King")'));
        await click('[data-action="follow-creature"]'); await click('#zoom-in'); await delay(400);
        assert.equal(await js('document.querySelector("[data-action=follow-creature]").getAttribute("aria-pressed")'),'false');
        checks.push('King inspector remains usable and manual zoom releases Follow');
        assert.deepEqual(errors,[]);
        await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks,errors},null,2));
        console.log(JSON.stringify({passed:checks.length,checks,errors},null,2));
        win.destroy();app.quit();
    } catch(error) {
        await screenshot('failure');console.error(error);console.error({checks,errors});
        win.destroy();app.exit(1);
    }
});
