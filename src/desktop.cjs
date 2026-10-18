const { app, BrowserWindow, Menu } = require('electron');
const path = require('node:path');
function create_window() {
    const win = new BrowserWindow({
        width: 1440, height: 940, minWidth: 760, minHeight: 580,
        title: 'Genesis Grove', backgroundColor: '#17221d',
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.loadFile(path.join(__dirname, '..', 'index.html'));
}
app.whenReady().then(() => {
    const template = [
        ...(process.platform === 'darwin' ? [{ label: 'Genesis Grove', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { type: 'separator' }, { role: 'quit' }] }] : []),
        { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
        { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'reload' }] },
        { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    create_window();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create_window(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
