const { app, BrowserWindow, ipcMain, shell, Notification, nativeTheme, Tray, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const APP_TITLE = 'NSL Chat';
let mainWindow = null;
let tray = null;
let deepLinkUrl = null;

function getWebDir() {
  if (isDev) return path.join(__dirname, '..');
  return path.join(process.resourcesPath, 'www');
}

function createWindow() {
  const webDir = getWebDir();
  const preloadScript = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    title: APP_TITLE,
    icon: path.join(webDir, 'app-icon-192.png'),
    backgroundColor: '#11131c',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: preloadScript,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.loadFile(path.join(webDir, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (tray && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (deepLinkUrl) {
      mainWindow.webContents.send('deep-link', deepLinkUrl);
      deepLinkUrl = null;
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createTray() {
  const iconPath = path.join(getWebDir(), 'app-icon-192.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ' + APP_TITLE, click: () => mainWindow && mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setToolTip(APP_TITLE);
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow && mainWindow.show());
}

function setupIPC() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:name', () => APP_TITLE);
  ipcMain.handle('app:platform', () => process.platform);
  ipcMain.handle('app:is-packaged', () => app.isPackaged);

  ipcMain.handle('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) { mainWindow.unmaximize(); return false; }
    mainWindow.maximize();
    return true;
  });
  ipcMain.handle('window:close', () => mainWindow && mainWindow.close());
  ipcMain.handle('window:is-maximized', () => mainWindow && mainWindow.isMaximized());
  ipcMain.handle('window:focus', () => mainWindow && mainWindow.focus());
  ipcMain.handle('window:set-always-on-top', (_, flag) => mainWindow && mainWindow.setAlwaysOnTop(flag));

  ipcMain.handle('notification:show', (_, opts) => {
    if (!Notification.isSupported()) return false;
    const notif = new Notification({
      title: opts.title || APP_TITLE,
      body: opts.body || '',
      icon: opts.icon || path.join(getWebDir(), 'app-icon-192.png'),
      silent: opts.silent || false
    });
    if (opts.onClick) notif.on('click', () => { mainWindow && mainWindow.show(); opts.onClick(); });
    notif.show();
    return true;
  });

  ipcMain.handle('shell:open-external', (_, url) => shell.openExternal(url));

  ipcMain.handle('theme:should-use-dark', () => nativeTheme.shouldUseDarkColors);

  ipcMain.on('window:set-title', (_, title) => {
    if (mainWindow) mainWindow.setTitle(title || APP_TITLE);
  });

  ipcMain.on('unread-count', (_, count) => {
    if (process.platform === 'win32' && tray) {
      tray.setToolTip(count > 0 ? `(${count}) ${APP_TITLE}` : APP_TITLE);
    }
    if (mainWindow) {
      const badge = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
      if (process.platform === 'darwin') app.setBadge(badge ? parseInt(badge) || 1 : 0);
      if (process.platform === 'win32') {
        mainWindow.setOverlayIcon(
          badge ? path.join(getWebDir(), 'app-icon-192.png') : null,
          badge ? `${count} unread` : ''
        );
      }
    }
  });
}

function setupDeepLinks() {
  if (process.platform === 'win32') {
    const cmdLine = process.argv.slice(1);
    if (cmdLine.length > 0) deepLinkUrl = cmdLine.find(a => a.startsWith('nslchat://'));
  }
  app.setAsDefaultProtocolClient('nslchat');
  app.on('open-url', (_, url) => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.send('deep-link', url);
    } else {
      deepLinkUrl = url;
    }
  });
}

app.whenReady().then(() => {
  setupIPC();
  setupDeepLinks();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow && mainWindow.show();
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
