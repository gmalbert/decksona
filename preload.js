const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('retro', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: input => ipcRenderer.invoke('settings:save', input),
  selectPlayer: id => ipcRenderer.invoke('settings:player', id),
  selectTheme: id => ipcRenderer.invoke('settings:theme', id),
  setCompact: compact => ipcRenderer.invoke('layout:setCompact', compact),
  command: (name, args) => ipcRenderer.invoke('api:command', name, args),
  image: image => ipcRenderer.invoke('api:image', image),
  artistImage: artists => ipcRenderer.invoke('api:artistImage', artists),
  openArtworkSource: url => ipcRenderer.invoke('artwork:source', url)
});
