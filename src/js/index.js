const {app, dialog} = require('electron').remote;
const remote = require('electron').remote;
const {shell} = require('electron');
const {ipcRenderer} = require('electron');
const fs = require('fs');
const os = require('os');
const Enum = require('./js/enum.js');
const {Menus, DownloadStatus, Tabs} = Enum;
const DownloadWrapper = require('./js/DownloadWrapper.js');
const Download = require("./js/Download");
const request = require('request');


const headers_el = document.querySelector('#dl-headers');
headers_el.setAttribute('style', 'overflow-y:hidden;');
headers_el.addEventListener('input', () => {
    headers_el.style.height = 'auto';
    headers_el.style.height = (headers_el.scrollHeight) + 'px';
});

function isJSON(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

document.querySelectorAll('a').forEach(element => element.addEventListener('click', e => {
    shell.openExternal(element.getAttribute('data-href'));
}));
const version = require('../package.json').version;

console.log('Version: ' + version);

checkUpdate(false);


ipcRenderer.on('check-update', () => {
    checkUpdate(true);
});

function checkUpdate(displayFailPrompt) {
    request({
        method: 'GET',
        url: 'https://raw.githubusercontent.com/jbis9051/quick_download/master/package.json',
    }, (error, response, body) => {
        if (error) {
            console.error("Error checking for update: " + error.toString());
            if (displayFailPrompt) {
                dialog.showMessageBox({
                    type: 'error',
                    title: 'Error Checking For Update',
                    buttons: ['Ok'],
                    message: `An error occurred while checking for an update. Check your network settings and try again. More details in the console.`
                });
            }
            return;
        }
        const currentVersion = JSON.parse(body).version;
        console.log('Current Version: ' + currentVersion);
        if (currentVersion !== version) {
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                buttons: ['Update', 'Cancel'],
                message: `An update is available. The current version is ${currentVersion}. This version is ${version}. Click "Update" and follow instructions to install the latest version of Quick Downloader.`
            }, response1 => {
                if (response1 === 0) {
                    shell.openExternal('https://jbis9051.github.io/quick_download/');
                }
            });
        } else if (displayFailPrompt) {
            if (displayFailPrompt) {
                dialog.showMessageBox({
                    type: 'info',
                    title: 'Up To Date',
                    buttons: ['Ok'],
                    message: `You currently have the most recent version of Quick Downloader: ${version}`
                });
            }
        }
    });
}


document.querySelector('#qd-version').innerText = version;
document.querySelector('#node-version').innerText = process.versions.node;
document.querySelector('#electron-version').innerText = process.versions.electron;
document.querySelector('#chrome-version').innerText = process.versions.chrome;
document.querySelector('#v8-version').innerText = process.versions.v8;

let downloads = [];
const settings = {
    getSavedSettingsSync: () => {
        if (fs.existsSync(app.getPath('userData') + "/settings.json")) {
            return JSON.parse(fs.readFileSync(app.getPath('userData') + "/settings.json", 'utf8'));
        }
        return {};
    },
    saveSettings: (callback) => {
        if (!callback) {
            callback = () => {
            };
        }
        fs.writeFile(app.getPath('userData') + "/settings.json", JSON.stringify(settings.items), 'utf8', callback);
    },
    _defaults: {
        theme: "dark",
        saveLocation: app.getPath('downloads'),
        proxyOptions: {
            type: "none",
            hostname: "",
            protocol: "https",
            port: "443",
            username: "",
            password: "",
            RequiresCredentials: false,
        },
        partsToCreate: 15,
        preferredUnit: (os.platform() === "win32" ? "bin" : "dec"),
        allowNotifications: true,
        showAdvancedDetails: true // DEBUG only
    },
    updateSettings: (updatedObject) => {
        settings.items = Object.assign({}, settings.items, updatedObject);
    },
    items: {},
};
settings.updateSettings(settings._defaults);
settings.updateSettings(settings.getSavedSettingsSync());


function addDownload(url, parts, customHeaders, proxyOptions, name) {
    const download = new DownloadWrapper(url, parts, customHeaders, proxyOptions, name, settings.items.saveLocation);
    download.on('remove', () => {
        downloads.splice(downloads.indexOf(download), 1);
    });
    download.on('startNextDownload', () => {
        startNextDownload();
    });
    downloads.push(download);
    hideMenus();
}


/* MENUS */

const MenusViews = {
    [Menus.NEW_DOWNLOAD]: document.querySelector('#new-download-menu'),
    [Menus.SETTINGS]: document.querySelector('#new-settings-menu'),
    [Menus.HISTORY]: document.querySelector('#new-history-menu'),
    [Menus.CONTACT]: document.querySelector('#new-contact-menu'),
    [Menus.ABOUT]: document.querySelector('#new-about-menu'),
};

function hideMenus() {
    Object.values(MenusViews).forEach(e => e.removeAttribute('data-active'));
}

function showMenu(MenuType) {
    MenusViews[MenuType].setAttribute('data-active', '');
}

function changeMenu(MenuType) {
    hideMenus();
    showMenu(MenuType);
}


document.querySelectorAll('.prompt_close_button').forEach(close_button => close_button.addEventListener('click', hideMenus));

document.querySelectorAll('.check-box').forEach(checkbox => checkbox.addEventListener('click', (e) => {
    if (checkbox.hasAttribute('data-disabled')) {
        return;
    }
    if (checkbox.classList.contains('checked')) {
        checkbox.classList.remove('checked');
    } else {
        checkbox.classList.add('checked');
    }
}));

/* TABS */
const TabViews = {
    [Tabs.QUEUE]: [document.querySelector('#queue-downloads'), document.querySelector('#queue-tab-button')],
    [Tabs.COMPLETED]: [document.querySelector('#complete-downloads'), document.querySelector('#complete-tab-button')],
};

function hideTabs() {
    Object.values(TabViews).forEach(e => e.forEach(e2 => e2.removeAttribute('data-active')));
}

function changeTabs(TabType) {
    hideTabs();
    TabViews[TabType].forEach(e => e.setAttribute('data-active', ''));
}

document.querySelector('#queue-tab-button').addEventListener('click', (e) => {
    changeTabs(Tabs.QUEUE);
});
document.querySelector('#complete-tab-button').addEventListener('click', (e) => {
    changeTabs(Tabs.COMPLETED);
});

/* DOWNLOAD MENU */
ipcRenderer.on('menu-new-download', () => {
    updateSettingsView(settings);
    changeMenu(Menus.SETTINGS);
});
document.querySelector('#new-download-button').addEventListener('click', (e) => {
    changeMenu(Menus.NEW_DOWNLOAD);
});
document.querySelector('#get-cookies-button').addEventListener('click', evt => {
    MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-headers').value += JSON.stringify({
        Cookie: ipcRenderer.sendSync('get-browser-cookies', "https://brownmovies.ddns.net").reduce((accumulator, current) => {
            accumulator += current.name + "=" + current.value + ";";
            return accumulator;
        }, "")
    });
});
MenusViews[Menus.NEW_DOWNLOAD].querySelector('#start-download').addEventListener('click', async (e) => {
    if (MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-headers').value.length !== 0 && !isJSON(MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-headers').value)) {
        dialog.showMessageBox({
            type: 'error',
            title: 'Error Parsing Headers',
            buttons: ['Ok'],
            message: "Error parsing custom headers. Please make sure they are valid JSON."
        });
        return;
    }
    let name = MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-name').value;
    const url = MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-url').value;
    if (fs.existsSync(Download.getFileName(name, settings.items.saveLocation, url))) {
        const result = await new Promise(resolve => {
            dialog.showMessageBox({
                    type: 'error',
                    title: 'File Exists',
                    buttons: ['Replace File', 'Keep Both', 'Cancel'],
                    defaultId: 2,
                    message: `A file named ${name} already exists in this location. Do you want to replace it??`
                },
                resolve,
            );
        });
        switch (result) {
            case 0:
                fs.unlinkSync(Download.getFileName(name, settings.items.saveLocation, url));
                break;
            case 1:
                let num = 1;
                while (fs.existsSync(Download.getFileName(name + " " + num, settings.items.saveLocation, url))) {
                    num++;
                }
                name = name + " " + num;
                break;
            case 2:
                return;
        }
    }
    const headers = JSON.parse(MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-headers').value || "{}");
    addDownload(
        MenusViews[Menus.NEW_DOWNLOAD].querySelector('#dl-url').value,
        settings.items.partsToCreate,
        headers,
        settings.items.proxySettings,
        name,
    );
});

function startNextDownload() {
    if (DownloadWrapper.getActiveDownloads(downloads).length > 0) {
        return;
    }
    const download = DownloadWrapper.getReadyDownloads(downloads)[0];
    if (download) {
        download.start();
    }
}

/* SETTINGS MENU */
ipcRenderer.on('menu-settings', () => {
    updateSettingsView(settings);
    changeMenu(Menus.SETTINGS);
});
document.querySelector('#path-chooser').addEventListener('click', (e) => {
    const path = dialog.showOpenDialog(remote.getCurrentWindow(), {properties: ['openDirectory']});
    if (path) {
        document.querySelector('#path-chooser').innerText = path[0];
    }
});
document.querySelector('#settings-button').addEventListener('click', (e) => {
    updateSettingsView(settings);
    changeMenu(Menus.SETTINGS);
});
document.querySelector('#revert-settings-button').addEventListener('click', async (e) => {
    if (JSON.stringify(settings.items) === JSON.stringify(settingsItemsObjectFromSettingsView())) {
        hideMenus();
        return;
    }
    const result = await new Promise(resolve => {
        dialog.showMessageBox({
                type: 'warning',
                title: 'Confirm Revert Settings',
                buttons: ['Ok', 'Cancel'],
                message: "Are you sure you want to revert your changes?"
            }, // "Confirm delete", "Are you sure you want to reset to default settings? Doing this will erase download history. But don't worry, things you have downloaded are safe."
            value => resolve(value === 0),
        );
    });
    if (result) {
        hideMenus();
    }
});
document.querySelector('#save-settings-button').addEventListener('click', async (e) => {
    settings.updateSettings(settingsItemsObjectFromSettingsView());
    settings.saveSettings();
    hideMenus();
});
document.querySelector('#reset-settings').addEventListener('click', async (e) => {
    const result = await new Promise(resolve => {
        dialog.showMessageBox({
                type: 'warning',
                title: 'Confirm Revert Settings',
                buttons: ['Ok', 'Cancel'],
                message: "Are you sure you want to revert to default settings? Your current settings will be erased."
            },
            value => resolve(value === 0),
        );
    });
    if (result) {
        settings.updateSettings(settings._defaults);
        settings.saveSettings();
        hideMenus();
    }
});

function settingsItemsObjectFromSettingsView() {
    return {
        theme: document.querySelector('#dark').checked ? "dark" : "light",
        saveLocation: document.querySelector('#path-chooser').innerText,
        proxyOptions: {
            type: document.querySelector('#https').checked ? "https" : "none",
            hostname: document.querySelector('#proxy-host').value,
            protocol: "https",
            port: document.querySelector('#proxy-port').value,
            username: document.querySelector('#proxy-username').value,
            password: document.querySelector('#proxy-password').value,
            RequiresCredentials: document.querySelector('#proxy-auth-toggle').classList.contains('checked')
        },
        partsToCreate: parseInt(document.querySelector('#numOfParts').value),
        preferredUnit: document.querySelector('#bin').checked ? "bin" : "dec",
        allowNotifications: document.querySelector('#notifications-toggle').classList.contains('checked'),
        showAdvancedDetails: document.querySelector('#advanced-details-toggle').classList.contains('checked'),
    };

}

function updateSettingsView(settings) {
    document.querySelector('#' + settings.items.theme).checked = true;
    if (settings.items.showAdvancedDetails) {
        document.querySelector('#advanced-details-toggle').classList.add('checked');
    } else {
        document.querySelector('#advanced-details-toggle').classList.remove('checked');
    }
    document.querySelector('#' + settings.items.theme).checked = true;
    document.querySelector('#path-chooser').innerText = settings.items.saveLocation;
    document.querySelector('#numOfParts').value = settings.items.partsToCreate;
    document.querySelector('#' + settings.items.preferredUnit).checked = true;
    if (settings.items.allowNotifications) {
        document.querySelector('#notifications-toggle').classList.add('checked');
    } else {
        document.querySelector('#notifications-toggle').classList.remove('checked');
    }
    document.querySelector('#' + settings.items.proxyOptions.type).checked = true;
    if (settings.items.proxyOptions.RequiresCredentials) {
        document.querySelector('#proxy-auth-toggle').classList.add('checked');
    } else {
        document.querySelector('#proxy-auth-toggle').classList.remove('checked');
    }
    document.querySelector('#proxy-host').value = settings.items.proxyOptions.hostname;
    document.querySelector('#proxy-port').value = settings.items.proxyOptions.port;
    updateProxyView();
    document.querySelector('#proxy-username').value = settings.items.proxyOptions.username;
    document.querySelector('#proxy-password').value = settings.items.proxyOptions.password;
}

function updateProxyView() {
    if (document.querySelector('#https').checked) {
        document.querySelector('.proxy-settings').removeAttribute('data-disabled');
        if (document.querySelector('#proxy-auth-toggle').classList.contains('checked')) {
            document.querySelector('.auth-settings').removeAttribute('data-disabled');
        } else {
            document.querySelector('.auth-settings').setAttribute('data-disabled', '');
        }
    } else {
        document.querySelector('.proxy-settings').setAttribute('data-disabled', '');
    }
}

/* ABOUT MENU */
ipcRenderer.on('menu-about', () => {
    changeMenu(Menus.ABOUT);
});
/* CONTACT */
ipcRenderer.on('menu-contact', () => {
    changeMenu(Menus.CONTACT);
});
