const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pavanDesktop', {
  getState: () => ipcRenderer.invoke('desktop:get-state'),
  pickWorkspace: () => ipcRenderer.invoke('desktop:pick-workspace'),
  launch: options => ipcRenderer.invoke('desktop:launch', options),
  onStatus: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('desktop:status', listener)
    return () => ipcRenderer.removeListener('desktop:status', listener)
  },
})
