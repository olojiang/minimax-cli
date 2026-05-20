const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('minimaxDesktop', {
  getConfig: () => ipcRenderer.invoke('desktop:get-config'),
  setApiToken: token => ipcRenderer.invoke('desktop:set-api-token', token),
  chooseGenerationRoot: () => ipcRenderer.invoke('desktop:choose-generation-root'),
  setShortcut: shortcut => ipcRenderer.invoke('desktop:set-shortcut', shortcut),
});
