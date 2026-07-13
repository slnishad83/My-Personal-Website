const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: () => ipcRenderer.invoke('app:platform'),
  version: () => ipcRenderer.invoke('app:version'),
  appName: () => ipcRenderer.invoke('app:name'),
  isPackaged: () => ipcRenderer.invoke('app:is-packaged'),

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    focus: () => ipcRenderer.invoke('window:focus'),
    setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:set-always-on-top', flag),
    setTitle: (title) => ipcRenderer.send('window:set-title', title),
    setUnreadCount: (count) => ipcRenderer.send('unread-count', count)
  },

  notification: {
    show: (opts) => ipcRenderer.invoke('notification:show', opts)
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },

  theme: {
    shouldUseDarkColors: () => ipcRenderer.invoke('theme:should-use-dark')
  },

  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (_, url) => callback(url));
  }
});
