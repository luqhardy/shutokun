// preload.js
// 必要に応じてNode.js APIをRendererに公開
window.electronAPI = {};

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  googleSignIn: () => ipcRenderer.invoke('google-sign-in')
});
