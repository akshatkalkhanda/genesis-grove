const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-speed-smoke-${process.pid}`));

app.whenReady().then(async () => {
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
    const click = async selector => {
        const p = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});
            e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();
            return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
        win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
        await delay(150);
    };
    try {
        const { World, T } = await import_src('simulation.js');
        const world = new World({ preset: 'empty', inhabited: false, seed: 'speed-native', name: 'Speed check' });
        world.tiles.fill(T.GRASS);
        world.laws.diplomacy = false; world.laws.expansion = false;
        world.laws.rebellions = false; world.laws.natural_events = false;
        await win.loadFile(path.join(__dirname, '..', 'index.html'));
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await wait_for('window.genesis && !document.querySelector("#start-screen").hidden', 'fresh world menu');
        await click('#menu-load');
        await wait_for('document.querySelector("#load-dialog").open', 'world import dialog');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(JSON.stringify(world.serialize()))}], 'speed.json',
                {type:'application/json'}));input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for('!document.querySelector("#load-dialog").open && genesis.snapshot().name==="Speed check"', 'empty world import');
        await js('document.querySelector("#menu-paint").click()');
        await wait_for('document.querySelector("#pause").getAttribute("aria-label")==="Resume time"', 'paused world view');

        const experimental = await js(`(()=>{const b=document.querySelector('[data-speed="200"]');
            const s=getComputedStyle(b),r=b.getBoundingClientRect();return {exists:!!b,visible:!!b.getClientRects().length,
                enabled:!b.disabled,text:b.textContent.trim(),title:b.title,aria:b.getAttribute('aria-label'),
                pointer:s.pointerEvents,rect:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`);
        assert.ok(experimental.exists && experimental.visible && experimental.enabled, '200x control exists and is actionable');
        assert.notEqual(experimental.pointer, 'none');
        const initial = await js('genesis.snapshot()');
        await click('[data-speed="200"]');
        assert.equal(await js('document.querySelector("[data-speed=\\"200\\"]").classList.contains("active")'), true);
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Pause time');
        const wall_start = performance.now();
        await delay(1600);
        const running = await js('genesis.snapshot()');
        const wall_seconds = (performance.now() - wall_start) / 1000;
        const advanced = running.time - initial.time;
        assert.ok(advanced > 0, '200x control advances simulation time');
        assert.ok(Math.abs(advanced / 0.125 - Math.round(advanced / 0.125)) < 1e-6,
            `Simulation advanced in 0.125-second steps (${advanced})`);

        await click('#pause');
        const paused = await js('JSON.stringify(genesis.snapshot())');
        await delay(450);
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), paused, 'Pause preserves the complete world snapshot');
        await click('[data-speed="1"]');
        assert.equal(await js('document.querySelector("[data-speed=\\"1\\"]").classList.contains("active")'), true);
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Pause time');
        await click('#pause');
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Resume time');
        checks.push(`200x button is clickable and advances by ${advanced} simulation seconds in 0.125-second steps; pause freezes snapshot; 1x switches back`);

        for (const width of [1024, 720]) {
            win.setSize(width, 768); await delay(200);
            const layout = await js(`(()=>{const footer=document.querySelector('footer'),controls=[...document.querySelectorAll('.time-controls > *')]
                .filter(e=>e.getClientRects().length),sound=document.querySelector('#sound'),fr=footer.getBoundingClientRect();
                const rs=controls.map(e=>e.getBoundingClientRect());
                const overlap=rs.some((a,i)=>rs.slice(i+1).some(b=>a.left<b.right-0.5&&b.left<a.right-0.5));
                return {overlap,overflow:rs.some(r=>r.left<fr.left||r.right>fr.right||r.top<fr.top||r.bottom>fr.bottom),
                    documentOverflow:document.documentElement.scrollWidth>innerWidth,soundVisible:!!sound.getClientRects().length,
                    soundOverlap:!!sound.getClientRects().length&&rs.some(r=>{const s=sound.getBoundingClientRect();
                        return r.left<s.right-0.5&&s.left<r.right-0.5&&r.top<s.bottom-0.5&&s.top<r.bottom-0.5})};})()`);
            assert.equal(layout.overlap, false, `${width}px footer controls do not overlap`);
            assert.equal(layout.overflow, false, `${width}px footer controls fit inside footer`);
            assert.equal(layout.documentOverflow, false, `${width}px document has no horizontal overflow`);
            assert.equal(layout.soundOverlap, false, `${width}px sound control does not overlap time controls`);
            checks.push(`${width}px footer controls fit without overlap or overflow${layout.soundVisible ? ', with sound visible' : ', sound hidden by responsive layout'}`);
        }
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ checks, observed_200x_sim_seconds: advanced,
            observed_wall_seconds: wall_seconds,
            observed_speed_ratio: advanced / wall_seconds,
            best_effort_note: 'Observed speed is bounded by the 12 ms frame budget and machine/world workload; this smoke does not assert guaranteed 200x.', errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        console.error(error); console.error({ checks, errors }); win.destroy(); app.exit(1);
    }
});
