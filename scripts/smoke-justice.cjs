const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const import_src = name => import(pathToFileURL(path.join(__dirname, '..', 'src', name)).href);
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-justice-smoke-${process.pid}`));

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
        const { apply_trait } = await import_src('character_traits.js');
        const { initialize_daily_life, attempt_theft } = await import_src('daily_life.js');
        const world = new World({ preset:'empty', inhabited:false, seed:'native-justice', name:'Civilian justice check' });
        world.tiles.fill(T.GRASS);
        for(const law of Object.keys(world.laws)) world.laws[law]=false;
        for(let i=0;i<20;i++) world.add_person(40+i%5,40+Math.floor(i/5));
        const kingdom=world.villages[0]; kingdom.food=10000; kingdom.wood=0;
        kingdom.research_level=1; kingdom.tech_points=8;
        kingdom.buildings.push({type:'police_station',x:45,y:42,growth:0,harvests:0,stock:0});
        const suspect=world.people[4],victim=world.people[3];
        suspect.x=victim.x=43; suspect.y=victim.y=43;
        initialize_daily_life(suspect); initialize_daily_life(victim);
        victim.daily_life.cargo.wood=1; apply_trait(suspect,'thief');
        const rng=world.random;world.random=()=>0;attempt_theft(world,suspect,victim);world.random=rng;
        for(let i=0;i<160&&world.justice.cases[0].status!=='jailed';i++)world.step(.125);
        assert.equal(world.justice.cases[0].status,'jailed');
        const fixture=JSON.stringify(world.serialize());
        const index=process.argv.includes('--packaged')
            ? path.join(__dirname,'..','dist','mac-arm64','Genesis Grove.app','Contents','Resources','app.asar','index.html')
            : path.join(__dirname,'..','index.html');
        await win.loadFile(index);
        await wait_for('Boolean(window.genesis)', 'diagnostic hook');
        await click('#menu-load');
        await js(`(()=>{const input=document.querySelector('#import'),dt=new DataTransfer();
            dt.items.add(new File([${JSON.stringify(fixture)}],'justice.json',{type:'application/json'}));
            input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
        await wait_for('!document.querySelector("#load-dialog").open&&genesis.snapshot().name==="Civilian justice check"','fixture import');
        await click('#menu-paint');await click('#zoom-reset');
        const frozen=await js('JSON.stringify(genesis.snapshot())');
        const officer=world.people.find(p=>p.id===world.justice.cases[0].officer_id);
        const point=await js(`(()=>{const c=genesis.camera(),r=document.querySelector('#viewport').getBoundingClientRect();
            return{x:r.left+c.origin.x+${officer.x}*6*c.base*c.zoom,
                y:r.top+c.origin.y+${officer.y}*6*c.base*c.zoom};})()`);
        const event={x:Math.round(point.x),y:Math.round(point.y),button:'left',clickCount:1};
        win.webContents.sendInputEvent({type:'mouseDown',...event});
        win.webContents.sendInputEvent({type:'mouseUp',...event});
        await wait_for('!document.querySelector("#entity-card").hidden','native police selection');
        assert.match(await js('document.querySelector("#entity-card").textContent'),/Police officer/);
        checks.push('Native map selection identifies the actual civilian police officer');
        await click('#diplomacy');
        await wait_for('document.querySelector("#diplomacy-dialog").open','kingdom inspector');
        await js('document.querySelectorAll("#kingdom-profile details").forEach(d=>d.open=true)');
        const text=await js('document.querySelector("#kingdom-profile").textContent');
        assert.match(text,/civilian police officers/);assert.match(text,/Civilian jail/);
        assert.match(text,/Theft cases & police/);assert.match(text,/jailed/);
        checks.push('Kingdom inspection shows actual police coverage, civilian jail and witnessed theft record');
        const fs=require('node:fs/promises'),artifacts=path.join(__dirname,'..','artifacts','justice');
        await fs.mkdir(artifacts,{recursive:true});
        for(const width of [1366,1024]){
            win.setSize(width,768);await delay(200);
            await js(`(()=>{const s=[...document.querySelectorAll('#kingdom-profile summary')].find(s=>s.textContent==='Theft cases & police');s.parentElement.open=true;s.scrollIntoView({block:'center'});})()`);
            assert.ok(await js('document.documentElement.scrollWidth<=innerWidth'));
            await fs.writeFile(path.join(artifacts,`justice-${width}.png`),(await win.webContents.capturePage()).toPNG());
        }
        assert.equal(await js('JSON.stringify(genesis.snapshot())'),frozen);
        checks.push('Paused inspection and compact layouts preserve the exact simulation snapshot');
        await js('document.querySelector("#diplomacy-dialog").close()');await click('[data-speed="20"]');
        await wait_for('genesis.snapshot().justice.cases[0].status==="closed"','sentence release');
        await click('#pause');
        assert.match(await js('genesis.snapshot().justice.cases[0].outcome'),/Released after serving/);
        assert.equal(await js('genesis.snapshot().people.find(p=>p.id==='+suspect.id+').prisoner_of??null'),null);
        checks.push('Loaded jail sentence advances in simulation time and releases without war captivity');
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify({checks,errors},null,2));win.destroy();app.quit();
    }catch(error){console.error(error);console.error({checks,errors});win.destroy();app.exit(1);}
});
