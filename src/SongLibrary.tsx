import SongCard from './SongCard'

interface SongLibraryProps {
  songs: Song[]
  onSongSelect: (song: Song) => void
  onFileOpen: () => void
  onClearAll: () => void
  onTestTab?: () => void
  selectedSongId?: string
}

export default function SongLibrary({
  songs,
  onSongSelect,
  onFileOpen,
  onClearAll,
  onTestTab,
  selectedSongId,
}: SongLibraryProps) {
  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-light italic tracking-wide text-zinc-100" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Play
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Open a tab, load a recent song, and keep the workspace ready for recording.</p>
        </div>
        {songs.length > 0 && (
          <button
            onClick={onClearAll}
            className="cursor-pointer text-xs text-zinc-600 transition-colors duration-150 ease-in-out hover:text-red-400"
          >
            Clear All
          </button>
        )}
      </div>

      {songs.length > 0 && (
        <div className="mb-10 grid grid-cols-3 gap-4">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              active={song.id === selectedSongId}
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

      {/* Test Tab Button (dev only) */}
      {onTestTab && (
        <div className="flex justify-center pb-6">
          <button onClick={onTestTab} className="cursor-pointer group">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-zinc-600 group-hover:text-amber-accent transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              <span className="text-zinc-500 text-xs font-medium group-hover:text-zinc-300 transition-colors">
                Use Test Tab
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
