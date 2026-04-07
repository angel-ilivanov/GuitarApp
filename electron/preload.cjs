const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  loadSongFile: (songId) => ipcRenderer.invoke('load-song-file', songId),
  updateSong: (songId, fields) => ipcRenderer.invoke('update-song', { songId, fields }),
  saveVideoTake: (buffer, songId) => ipcRenderer.invoke('save-video-take', { buffer, songId }),
  getTakesForSong: (songId) => ipcRenderer.invoke('get-takes-for-song', songId),
  deleteTake: (songId, takeId) => ipcRenderer.invoke('delete-take', { songId, takeId }),
  renameTake: (songId, takeId, name) => ipcRenderer.invoke('rename-take', { songId, takeId, name }),
  updateTakeRating: (songId, takeId, rating) => ipcRenderer.invoke('update-take-rating', { songId, takeId, rating }),
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  clearLibrary: () => ipcRenderer.invoke('clear-library'),
});
