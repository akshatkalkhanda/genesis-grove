const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-menu-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'menu');
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
    const click = async selector => {
        const p = await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});
            e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();
            return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
        win.webContents.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
        win.webContents.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 }); await delay(150);
    };
    const key = async keyCode => {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode });
        if (keyCode === 'Enter') win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode }); await delay(150);
    };
    const screenshot = async name => fs.writeFile(path.join(artifacts, `${name}.png`),
        (await win.webContents.capturePage()).toPNG());
    const bounds = async mode => {
        for (const width of [1366, 1024]) {
            win.setSize(width, 768); await delay(200);
            assert.ok(await js(`(()=>{const card=document.querySelector('.start-card'),r=card.getBoundingClientRect();
                const buttons=[...card.querySelectorAll('button')].filter(e=>e.getClientRects().length);
                return r.width<=560&&r.height<=600&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight
                    &&buttons.every(e=>{const b=e.getBoundingClientRect();return b.height>=36&&b.left>=r.left&&b.right<=r.right&&b.bottom<=r.bottom;})
                    &&document.documentElement.scrollWidth<=innerWidth
                    &&getComputedStyle(document.querySelector('#start-screen'),'::before').display==='none';})()`));
            await screenshot(`${mode}-${width}x768`);
        }
    };
    try {
        const packaged_index = path.join(__dirname, '..', 'dist', 'mac-arm64',
            'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html');
        const index = process.env.GENESIS_SMOKE_INDEX || (process.argv.includes('--packaged')
            ? packaged_index : path.join(__dirname, '..', 'index.html'));
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await wait_for('window.genesis && !document.querySelector("#start-screen").hidden', 'fresh main menu');
        await delay(500);
        assert.equal(await js('document.querySelector("#menu-continue").disabled'), true);
        assert.equal(await js('document.querySelector("#menu-resume").hidden'), true);
        const initial = await js('JSON.stringify(genesis.snapshot())');
        await bounds('fresh-menu');
        // Focus setup selects the menu entry point; Enter/Tab are actual native keyboard events.
        await js('document.querySelector("#menu-create").focus()'); await key('Tab');
        assert.equal(await js('document.activeElement.id'), 'menu-load', 'Unavailable Continue is skipped by keyboard navigation');
        await key('Enter'); await wait_for('document.querySelector("#load-dialog").open', 'keyboard world library');
        assert.ok(await js('document.querySelector("#saved-world").textContent.includes("0 / 12 named saves")'));
        await key('Escape'); await click('#menu-audio');
        await wait_for('document.querySelector("#audio-dialog").open', 'secondary sound settings'); await key('Escape');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'), initial, 'Menu, library and sound opening preserve the fresh world');
        await js('document.querySelector("#menu-create").focus()'); await key('Enter');
        await wait_for('document.querySelector("#new-dialog").open', 'keyboard Create');
        await js(`(()=>{const f=document.querySelector('#new-form');f.elements.name.value='Menu test world';
            f.elements.seed.value='menu-native';document.querySelector('#preset').value='islands';
            document.querySelector('#inhabited').checked=true;})()`);
        await click('#new-form button[type="submit"]');
        await wait_for('!document.querySelector("#new-dialog").open&&genesis.snapshot().name==="Menu test world"&&!document.querySelector("#start-ready").hidden', 'created world ready');
        await delay(3500);
        const ready = await js('JSON.stringify(genesis.snapshot())'); await bounds('world-ready');
        assert.ok(await js(`document.querySelector('#start-message').textContent.includes(genesis.snapshot().name)`));
        assert.ok(await js(`document.querySelector('#start-detail').textContent.startsWith(genesis.stats().land+'% land')`));
        await click('#menu-edit'); await wait_for('document.querySelector("#new-dialog").open', 'Different world setup');
        await key('Escape'); assert.equal(await js('JSON.stringify(genesis.snapshot())'), ready);
        await click('#menu-paint');
        assert.equal(await js('document.querySelector("#start-screen").hidden'), true);
        assert.equal(await js('document.querySelector("#pause").getAttribute("aria-label")'), 'Resume time');
        checks.push('Compact fresh and ready menus fit1366/1024; disabled Continue is honest, native keyboard Create/library and secondary sound work without menu mutations');
        await click('#save'); await wait_for('document.querySelector("#save-dialog").open', 'named save');
        await js('document.querySelector("#slot-name").value="Menu checkpoint";document.querySelector("#save-mode").value="new"');
        await click('#commit-save'); await wait_for('!document.querySelector("#save-dialog").open', 'saved checkpoint');
        const saved = await js('genesis.snapshot()'); await click('#menu');
        await wait_for('!document.querySelector("#menu-continue").disabled', 'Continue enabled for real saved copy');
        assert.equal(await js('document.querySelector("#menu-resume").hidden'), false);
        await bounds('current-session');
        await click('#menu-resume'); assert.equal(await js('document.querySelector("#start-screen").hidden'), true);
        if (await js('document.querySelector("#pause").getAttribute("aria-label")==="Pause time"')) await click('#pause');
        await win.loadFile(index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await wait_for('window.genesis && !document.querySelector("#menu-continue").disabled', 'saved menu after fresh launch');
        assert.equal(await js('document.querySelector("#menu-resume").hidden'), true);
        await bounds('saved-menu');
        await js('document.querySelector("#menu-continue").focus()'); await key('Enter');
        await wait_for('!document.querySelector("#start-ready").hidden&&genesis.snapshot().name==="Menu test world"', 'native keyboard Continue');
        assert.deepEqual(await js('genesis.snapshot()'), saved, 'Continue loads the actual saved world exactly');
        await click('#menu-start');
        assert.equal(await js('document.querySelector("#start-screen").hidden'), true);
        if (await js('document.querySelector("#pause").getAttribute("aria-label")==="Pause time"')) await click('#pause');
        checks.push('A real named save enables Continue across relaunch; current-session Return and native keyboard Continue/Start preserve existing launch flows');
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ checks, errors }, null, 2));
        console.log(JSON.stringify({ passed: checks.length, checks, errors }, null, 2));
        win.destroy(); app.quit();
    } catch (error) {
        await screenshot('failure'); console.error(error); console.error({ checks, errors });
        win.destroy(); app.exit(1);
    }
});
