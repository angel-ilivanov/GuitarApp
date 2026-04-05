interface Take {
  id: string
  takeNumber: number
  date: string
  speed: number
  filePath: string
  createdAt: string
  rating?: number
  name?: string
}

interface RecentSong {
  songFilename: string
  gpFilePath: string
  lastOpened: number
  takesCount: number
  title: string
  artist: string
}

interface OpenFileResult {
  cancelled: boolean
  buffer?: Uint8Array
  fileName?: string
  filePath?: string
}

interface LoadRecentResult {
  buffer?: Uint8Array
  fileName?: string
  error?: string
}

interface SongObject {
  id: string
  title: string
  artist: string
  bpm: number
  nextTakeNumber: number
  albumArt?: string
  tuning?: string
  paths: {
    tabFile: string
    takesFolder: string
  }
  stats: {
    totalTakes: number
  }
}

interface Window {
  electronAPI?: {
    isElectron: boolean
    saveVideoTake: (buffer: ArrayBuffer, songFilename: string, songName?: string) => Promise<{ success: boolean; path?: string; take?: Take }>
    getTakesForSong: (songFilename: string) => Promise<Take[]>
    openFileDialog: () => Promise<OpenFileResult>
    getRecentSongs: () => Promise<RecentSong[]>
    loadRecentFile: (filePath: string, songFilename: string) => Promise<LoadRecentResult>
    updateSongMeta: (songFilename: string, title: string, artist: string) => Promise<void>
    deleteTake: (songFilename: string, takeId: string) => Promise<{ success: boolean }>
    renameTake: (songFilename: string, takeId: string, name: string) => Promise<void>
    updateTakeRating: (songFilename: string, takeId: string, rating: number) => Promise<void>
    addNewSong: (filePath: string, title: string, artist: string, bpm: number) => Promise<SongObject>
    getAllSongs: () => Promise<SongObject[]>
    clearLibrary: () => Promise<void>
    updateSongAlbumArt: (songId: string, albumArt: string) => Promise<void>
  }
}
