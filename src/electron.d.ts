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

interface Song {
  id: string
  title: string
  artist: string
  bpm: number
  tuning: string
  albumArt?: string
  paths: {
    tabFile: string
    takesFolder: string
  }
  takes: Take[]
  nextTakeNumber: number
  lastOpened: number
  createdAt: string
}

interface OpenFileResult {
  cancelled: boolean
  buffer?: Uint8Array
  songId?: string
  filePath?: string
}

interface LoadSongFileResult {
  buffer?: Uint8Array
  fileName?: string
  error?: string
}

interface Window {
  electronAPI?: {
    isElectron: boolean
    openFileDialog: () => Promise<OpenFileResult>
    loadSongFile: (songId: string) => Promise<LoadSongFileResult>
    updateSong: (songId: string, fields: Partial<Pick<Song, 'title' | 'artist' | 'bpm' | 'tuning' | 'albumArt'>>) => Promise<void>
    saveVideoTake: (buffer: ArrayBuffer, songId: string) => Promise<{ success: boolean; path?: string; take?: Take }>
    getTakesForSong: (songId: string) => Promise<Take[]>
    deleteTake: (songId: string, takeId: string) => Promise<{ success: boolean }>
    renameTake: (songId: string, takeId: string, name: string) => Promise<void>
    updateTakeRating: (songId: string, takeId: string, rating: number) => Promise<void>
    getAllSongs: () => Promise<Song[]>
    clearLibrary: () => Promise<void>
  }
}
