const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  saveVideoTake: (buffer, songFilename, songName) => ipcRenderer.invoke('save-video-take', { buffer, songFilename, songName }),
  getTakesForSong: (songFilename) => ipcRenderer.invoke('get-takes-for-song', songFilename),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  updateSongMeta: (songFilename, title, artist) => ipcRenderer.invoke('update-song-meta', { songFilename, title, artist }),
  getRecentSongs: () => ipcRenderer.invoke('get-recent-songs'),
  loadRecentFile: (filePath, songFilename) => ipcRenderer.invoke('load-recent-file', { filePath, songFilename }),
  deleteTake: (songFilename, takeId) => ipcRenderer.invoke('delete-take', { songFilename, takeId }),
  renameTake: (songFilename, takeId, name) => ipcRenderer.invoke('rename-take', { songFilename, takeId, name }),
  updateTakeRating: (songFilename, takeId, rating) => ipcRenderer.invoke('update-take-rating', { songFilename, takeId, rating }),
  addNewSong: (filePath, title, artist, bpm) => ipcRenderer.invoke('add-new-song', { filePath, title, artist, bpm }),
  getAllSongs: () => ipcRenderer.invoke('get-all-songs'),
  clearLibrary: () => ipcRenderer.invoke('clear-library'),
  updateSongAlbumArt: (songId, albumArt) => ipcRenderer.invoke('update-song-album-art', { songId, albumArt }),
});
