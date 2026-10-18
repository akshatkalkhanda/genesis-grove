const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
app.whenReady().then(async () => {
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    try {
        await win.loadFile(path.join(__dirname, '..', 'index.html'));
        const png = await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;canvas.getContext('2d').drawImage(image,0,0,1024,1024);resolve(canvas.toDataURL('image/png').split(',')[1])};image.onerror=()=>reject(new Error('Could not render SVG icon'));image.src='assets/mark.svg'})`);
        await fs.writeFile(path.join(__dirname, '..', 'assets', 'icon.png'), Buffer.from(png, 'base64'));
        console.log('Rendered 1024px desktop icon from original SVG.');
        win.destroy(); app.quit();
    } catch (error) { console.error(error); app.exit(1); }
});
