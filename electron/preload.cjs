const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('minimaxDesktop', {
  getConfig: () => ipcRenderer.invoke('desktop:get-config'),
  setShortcut: shortcut => ipcRenderer.invoke('desktop:set-shortcut', shortcut),
});
