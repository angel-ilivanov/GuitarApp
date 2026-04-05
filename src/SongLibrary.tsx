import { useEffect, useState } from 'react'
import SongCard from './SongCard'

interface SongLibraryProps {
  onSongSelect: (song: SongObject) => void
  onFileOpen: () => void
  refreshKey: number
}

export default function SongLibrary({ onSongSelect, onFileOpen, refreshKey }: SongLibraryProps) {
  const [songs, setSongs] = useState<SongObject[]>([])

  useEffect(() => {
    window.electronAPI?.getAllSongs().then(setSongs)
  }, [refreshKey])

  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      {/* Title + Clear */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-zinc-100 text-3xl font-light italic tracking-wide" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
          My Songs
        </h1>
        {songs.length > 0 && (
          <button
            onClick={async () => {
              await window.electronAPI?.clearLibrary()
              setSongs([])
            }}
            className="text-zinc-600 text-xs hover:text-red-400 transition-colors cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Song Grid */}
      {songs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-10">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onClick={() => onSongSelect(song)}
            />
          ))}
        </div>
      )}

      {/* Open File Button */}
      <div className="flex justify-center py-6">
        <button onClick={onFileOpen} className="cursor-pointer group">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-zinc-500 group-hover:text-amber-accent transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-zinc-400 text-sm font-medium group-hover:text-zinc-300 transition-colors">
                Open Guitar Pro File
              </span>
            </div>
            <p className="text-zinc-600 text-xs">.gp .gp3 .gp4 .gpx</p>
          </div>
        </button>
      </div>
    </div>
  )
}
