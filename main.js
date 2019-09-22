const os = require('os');
const {app, BrowserView, BrowserWindow, ipcMain, Menu, shell} = require('electron');

let mainWindow;

const path = require('path');

async function createWindow() {
    mainWindow = new BrowserWindow({
        minWidth: 720,
        minHeight: 360,
        width: 720,
        height: 360,
        titleBarStyle: "hidden",
        backgroundColor: '#3e444b',
        frame: os.platform() !== "win32",
        icon: "./build/favicon.ico",
        webPreferences: {nodeIntegration: true},
        // autoHideMenuBar: true
    });
    let view = new BrowserView();
    view.setBounds({x: 0, y: 0, width: 300, height: 300});
    view.webContents.loadURL('https://electronjs.org');
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
    mainWindow.setTitle("Quick Downloader");
    await mainWindow.loadFile(path.join(__dirname, './src/index.html'));

    if (process.platform !== "win32")
        createMenu();
    else
        mainWindow.setMenu(null);
}

app.setAppUserModelId(process.execPath);

app.on('ready', createWindow);

function createMenu() {
    // mainWindow.toggleDevTools();
    let template = [{
        label: 'Quick Downloader',
        submenu: [{
            label: 'About Quick Downloader',
            async click() {
                if (mainWindow === null) {
                    await createWindow();
                }
                mainWindow.webContents.send("menu-about");
            },
        },
            {
                label: 'Check for updates...',
                async click() {
                    if (mainWindow === null) {
                        await createWindow();
                    }
                    mainWindow.webContents.send("check-update");
                }
            },
            {type: 'separator'},
            {
                label: 'Preferences...',
                async click() {
                    if (mainWindow === null) {
                        await createWindow();
                    }
                    mainWindow.webContents.send("menu-settings");
                },
                accelerator: 'Cmd+,',
            },
            {role: 'services'},
            {type: 'separator'},
            {role: 'hide'},
            {role: 'hideothers'},
            {type: 'separator'},
            {role: 'Quit'}
        ]
    },
        {
            label: 'File',
            submenu: [{
                label: 'New Download...',
                async click() {
                    if (mainWindow === null) {
                        await createWindow();
                    }
                    mainWindow.webContents.send("menu-new-download");
                },
                accelerator: 'Cmd+N'
            }],
        },

        {
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                {role: 'delete'},
                {role: 'selectall'}
            ]
        },

        {
            label: 'View',
            submenu: [{
                label: "Theme",
                submenu: [
                    {label: "Dark", type: "radio", checked: true}, {label: "Light", type: "radio", enabled: false}
                ]
            },
                {role: 'reload'},
                {role: 'forcereload'},
                {role: 'toggledevtools'},
                {type: 'separator'},
                {role: 'resetzoom'},
                {role: 'zoomin'},
                {role: 'zoomout'},
                {type: 'separator'},
                {role: 'togglefullscreen'},
            ]
        },
        {
            role: 'window',
            submenu: [
                {role: 'minimize'},
                {role: 'close'}
            ]
        },
        {
            label: 'Help',
            submenu: [{
                label: 'Contact Developers',
                async click() {
                    if (mainWindow === null) {
                        await createWindow();
                    }
                    mainWindow.webContents.send("menu-contact")
                }
            },
                {
                    label: 'Learn More',
                    click() {
                        shell.openExternal('https://github.com/jbis9051/quick_download')
                    }
                },
                {
                    label: 'Contribute',
                    click() {
                        shell.openExternal('https://github.com/jbis9051/quick_download')
                    }
                },
                {
                    label: "About",
                    async click() {
                        if (mainWindow === null) {
                            await createWindow();
                        }
                        mainWindow.webContents.send("menu-about")
                    }
                },
                {
                    label: "Docs",
                    click() {
                        shell.openExternal('https://github.com/jbis9051/quick_download')
                    }
                }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    // mainWindow.setMenu(Menu.buildFromTemplate(template));
}

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
ipcMain.on('toggledevtools', () => {
    mainWindow.toggleDevTools();
});

ipcMain.on('progress', (e, progress) => {
    mainWindow.setProgressBar(progress);
});

ipcMain.on('get-browser-cookies', async (e, url) => {
    e.returnValue = await new Promise(resolve => {
        let browserWindow = new BrowserWindow({
            minWidth: 720,
            minHeight: 360,
            width: 720,
            height: 720,
            titleBarStyle: "default",
            icon: "./build/favicon.ico",
            webPreferences: {nodeIntegration: false, sandbox: true}
        });
        console.log(url);
        browserWindow.loadURL(url);
        browserWindow.on('close', () => {
            browserWindow.webContents.session.cookies.get({url: url}, ((error, cookies) => {
                resolve(cookies);
            }));
            browserWindow.webContents.session.clearStorageData();
        });
    });
});
