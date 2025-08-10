const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vrmApi', {
  onOpenFile: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on('open-file', listener);
    return () => ipcRenderer.removeListener('open-file', listener);
  },
  getInitialOpenPath: async () => ipcRenderer.invoke('get-initial-open-path'),
  readFileBuffer: async (filePath) => ipcRenderer.invoke('read-file-buffer', filePath),
});


