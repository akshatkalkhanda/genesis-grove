const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
app.commandLine.appendSwitch('disable-gpu');
app.setPath('userData', path.join(app.getPath('temp'), `genesis-clothing-${process.pid}`));

app.whenReady().then(async () => {
    const win = new BrowserWindow({ width: 1024, height: 768, show: false,
        webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
    const errors = [];
    win.webContents.on('console-message', event => {
        if (event.level === 'error') errors.push(event.message);
    });
    const js = code => win.webContents.executeJavaScript(code, true);
    try {
        await win.loadFile(path.join(__dirname, '..', 'index.html'));
        const renderer = pathToFileURL(path.join(__dirname, '..', 'src', 'renderer.js')).href;
        const result = await js(`(async () => {
            const { Renderer } = await import(${JSON.stringify(renderer)});
            const before = JSON.stringify(genesis.snapshot());
            const sample = genesis.snapshot().people[0];
            const canvas = document.createElement('canvas'); canvas.width=800; canvas.height=380;
            const c=canvas.getContext('2d');c.fillStyle='#152a22';c.fillRect(0,0,800,380);
            c.font='16px sans-serif';c.fillStyle='#dce8cf';
            c.fillText('Clothing silhouettes · actual map/portrait renderer',24,30);
            const races=['human','elf','dwarf','orc','foxfolk','beetlefolk'];
            const roles=['Civilian','Soldier','Doctor'];
            for(let row=0;row<3;row++) for(let col=0;col<6;col++) {
                const kingdom={id:1,color:col%2?'#7ca9ef':'#65d58c'};
                for(let style=0;style<2;style++) {
                    const person={...sample,id:10+col*2+style,x:0,y:0,race:races[col],
                        outfit_style:style?'female':'male',role:row===1?'soldier':'civilian',
                        medical_role:row===2?'doctor':null,armor_level:row===1?3:0,
                        weapon_level:row===1?3:0,prisoner_of:null,task:'Socializing',
                        daily_life:{phase:'social'},age:400,dx:1};
                    c.save();c.translate(45+col*130+style*48,105+row*110);c.scale(3,3);
                    Renderer.prototype.person.call({zoom:12,selected_unit_id:null},c,person,kingdom,0,20);
                    c.restore();
                }
                c.fillStyle='#dce8cf';c.font='12px sans-serif';
                c.fillText(races[col]+' · '+roles[row],16+col*130,140+row*110);
                c.fillText('Male / Female',16+col*130,156+row*110);
            }
            return {png:canvas.toDataURL('image/png').split(',')[1],
                unchanged:before===JSON.stringify(genesis.snapshot()),
                button:!!document.querySelector('[data-speed="200"]')};
        })()`);
        assert.equal(result.unchanged, true, 'Drawing clothing preserves paused simulation state');
        assert.equal(result.button, true, 'Experimental speed control remains present');
        assert.deepEqual(errors, []);
        const directory = path.join(__dirname, '..', 'artifacts', 'clothing');
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, 'outfit-gallery.png'), Buffer.from(result.png, 'base64'));
        console.log('PASS: 36 native portraits, both outfit styles, 6 races, 3 roles; state unchanged; zero renderer errors.');
        win.destroy(); app.quit();
    } catch (error) {
        console.error(error); win.destroy(); app.exit(1);
    }
});
