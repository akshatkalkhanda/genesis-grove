const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-audio-smoke-${process.pid}`));

app.whenReady().then(async () => {
    const artifacts = path.join(__dirname, '..', 'artifacts', 'audio-feedback');
    await fs.mkdir(artifacts, { recursive: true });
    const win = new BrowserWindow({ width: 1366, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    win.showInactive();
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
        const game_index = process.argv.includes('--packaged')
            ? path.join(__dirname, '..', 'dist', 'mac-arm64', 'Genesis Grove.app', 'Contents', 'Resources', 'app.asar', 'index.html')
            : path.join(__dirname, '..', 'index.html');
        await win.loadFile(game_index);
        await win.webContents.insertCSS('* {transition:none!important;animation:none!important;scroll-behavior:auto!important}');
        await click('#menu-audio');
        assert.equal(await js('document.querySelector("#audio-dialog").open'),true);
        assert.equal(await js('genesis.audio().enabled'),false);
        const rendered = await js(`(async()=>{
            const {SOUND_PROFILES,synthesize_effect}=await import('./src/game_audio.js');const result=[];
            for(const name of Object.keys(SOUND_PROFILES)){
                const c=new OfflineAudioContext(1,96000,48000);synthesize_effect(c,c.destination,name);
                const b=await c.startRendering(),a=b.getChannelData(0);let peak=0,energy=0,fingerprint=0;
                for(let i=0;i<a.length;i++){peak=Math.max(peak,Math.abs(a[i]));energy+=a[i]*a[i];fingerprint+=a[i]*((i%97)+1)}
                result.push({name,peak,rms:Math.sqrt(energy/a.length),fingerprint});
            }return result;
        })()`);
        assert.ok(rendered.length>=29);
        assert.ok(rendered.every(r=>r.peak>0.001&&r.peak<.95&&r.rms>0.0001));
        assert.equal(new Set(rendered.map(r=>r.fingerprint.toFixed(5))).size,rendered.length);
        checks.push('Every synthesized action sound renders non-silent, finite, distinct and unclipped PCM');
        await click('#audio-enabled');
        await wait_for('genesis.audio().enabled && genesis.audio().effects>0','enabled audio cue');
        await delay(500);
        const local_voices=await js('genesis.audio().local_voices');
        if(local_voices){
            await wait_for('genesis.audio().started>0','real local speech start');
            await wait_for('genesis.audio().finished>0 || genesis.audio().speech_error','local speech completion');
            assert.equal(await js('genesis.audio().speech_error'),'');
            checks.push('Installed local voice emits native speech start and successful completion');
        } else {
            assert.ok(await js('document.querySelector("#audio-status").textContent.includes("No installed voice")'));
            checks.push('Unavailable local speech is clearly shown; sound effects remain enabled');
        }
        await screenshot('audio-settings-1366');
        for(const kind of ['effects','ambience','voice']){
            await js(`(()=>{const e=document.querySelector('#audio-${kind}-volume');e.value='35';e.dispatchEvent(new Event('input'))})()`);
            assert.equal(await js(`JSON.parse(localStorage.getItem('genesis-grove-audio-v1')).${kind}`),.35);
        }
        await click('#audio-narration');
        assert.equal(await js('genesis.audio().speaking || genesis.audio().pending'),false);
        assert.equal(await js('JSON.parse(localStorage.getItem("genesis-grove-audio-v1")).narration'),false);
        await click('#audio-preview');await delay(100);
        assert.ok(await js('genesis.audio().effects>1'));
        checks.push('Independent volume controls persist; narration mute cancels speech while preview effects work');
        for(const width of [1024,1366]){
            win.setSize(width,768);await delay(200);
            assert.ok(await js('(()=>{const r=document.querySelector("#audio-dialog").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()'));
            await screenshot(`audio-settings-${width}`);
        }
        await click('#audio-dialog [data-close]');
        await click('#menu-create');
        await js(`document.querySelector('#new-form [name=seed]').value='audio-native';document.querySelector('#new-form').requestSubmit()`);
        await wait_for('!document.querySelector("#new-dialog").open','new world');await click('#menu-start');await click('#pause');
        const before=await js('JSON.stringify(genesis.snapshot())');
        const sound_before=await js('genesis.audio().effects');
        await click('#zoom-in');await delay(200);await click('#zoom-reset');
        await click('#sound');await click('#audio-enabled');
        const muted=await js('genesis.audio().effects');
        await click('#audio-dialog [data-close]');await click('#zoom-in');await delay(150);await click('#zoom-reset');
        assert.equal(await js('genesis.audio().effects'),muted);
        assert.ok(muted>sound_before,'camera and UI actions emitted cues before mute');
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),before,'audio settings and camera sounds cannot mutate the world');
        checks.push('Settings fit both desktop sizes; live UI/camera cues work, master mute stops cues, paused save unchanged');
        assert.deepEqual(errors,[]);
        await fs.writeFile(path.join(artifacts,'results.json'),JSON.stringify({checks,errors,rendered,local_voices},null,2));
        console.log(JSON.stringify({passed:checks.length,checks,errors,local_voices},null,2));
        win.destroy();app.quit();
    }catch(error){await screenshot('failure');console.error(error);console.error({checks,errors});win.destroy();app.exit(1);}
});
