const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  writeFile: (opts) => ipcRenderer.invoke('fs:writeFile', opts),
  onUpdaterStatus: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  installUpdate: () => ipcRenderer.invoke('updater:install'),
})
