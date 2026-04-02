interface Take {
  id: string
  date: string
  speed: number
  filePath: string
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

interface Window {
  electronAPI?: {
    isElectron: boolean
    saveVideoTake: (buffer: ArrayBuffer, songFilename: string) => Promise<{ success: boolean; path?: string; take?: Take }>
    getTakesForSong: (songFilename: string) => Promise<Take[]>
    openFileDialog: () => Promise<OpenFileResult>
    getRecentSongs: () => Promise<RecentSong[]>
    loadRecentFile: (filePath: string, songFilename: string) => Promise<LoadRecentResult>
    updateSongMeta: (songFilename: string, title: string, artist: string) => Promise<void>
  }
}
