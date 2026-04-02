const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveVideoTake: (buffer, songFilename) => ipcRenderer.invoke('save-video-take', { buffer, songFilename }),
  getTakesForSong: (songFilename) => ipcRenderer.invoke('get-takes-for-song', songFilename),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  updateSongMeta: (songFilename, title, artist) => ipcRenderer.invoke('update-song-meta', { songFilename, title, artist }),
  getRecentSongs: () => ipcRenderer.invoke('get-recent-songs'),
  loadRecentFile: (filePath, songFilename) => ipcRenderer.invoke('load-recent-file', { filePath, songFilename }),
});
