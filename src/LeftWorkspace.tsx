import { useMemo, type ReactNode } from 'react'
import SongLibrary from './SongLibrary'
import TakesLibraryView from './TakesLibraryView'
import type { LeftView, LibraryFilter } from './librarySelectors'

interface ReviewSelection {
  songId: string
  takeId: string
}

interface LeftWorkspaceProps {
  leftView: LeftView
  scoreLoaded: boolean
  songTitle: string
  songArtist: string
  bpm: number
  timeSig: string
  isPlaybackActive: boolean
  appState: 'idle' | 'countdown' | 'recording' | 'playing'
  activeSongId: string
  songs: Song[]
  activeLibraryFilter: LibraryFilter
  reviewSelection: ReviewSelection | null
  onSetLeftView: (view: LeftView) => void
  onTogglePlay: () => void
  onLoadSong: (song: Song) => void
  onOpenFile: () => void
  onClearAll: () => void
  onTestTab: () => void
  onFilterChange: (filter: LibraryFilter) => void
  onRateTake: (songId: string, takeId: string, rating: number) => void
  onDeleteTake: (songId: string, takeId: string) => void
  onPlayTake: (songId: string, takeId: string) => void
  onExpandTake: (songId: string, takeId: string) => void
  children: ReactNode
}

function WorkspaceTab({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b px-1 pb-4 pt-1 text-sm font-semibold uppercase tracking-[0.28em] transition-all duration-150 ease-in-out ${
        active
          ? 'border-amber-accent text-amber-accent'
          : 'border-transparent text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  )
}

export default function LeftWorkspace({
  leftView,
  scoreLoaded,
  songTitle,
  songArtist,
  bpm,
  timeSig,
  isPlaybackActive,
  appState,
  activeSongId,
  songs,
  activeLibraryFilter,
  reviewSelection,
  onSetLeftView,
  onTogglePlay,
  onLoadSong,
  onOpenFile,
  onClearAll,
  onTestTab,
  onFilterChange,
  onRateTake,
  onDeleteTake,
  onPlayTake,
  onExpandTake,
  children,
}: LeftWorkspaceProps) {
  const currentPlaySongs = useMemo(
    () => [...songs].sort((a, b) => b.lastOpened - a.lastOpened),
    [songs],
  )

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-800 px-6 pt-5">
        <div className="flex items-center gap-8">
          <WorkspaceTab active={leftView === 'play'} label="Play" onClick={() => onSetLeftView('play')} />
          <WorkspaceTab active={leftView === 'takesLibrary'} label="Takes Library" onClick={() => onSetLeftView('takesLibrary')} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-150 ease-in-out ${
            leftView === 'play' ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {scoreLoaded && (
            <div className="shrink-0 border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold uppercase tracking-wide text-zinc-100">
                    {songArtist && <>{songArtist} - </>}
                    "{songTitle || 'Untitled'}"
                  </h1>
                  <div className="mt-1 flex items-center gap-4">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">BPM: {bpm || '--'}</span>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Time Sig: {timeSig || '--'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onTogglePlay}
                  disabled={!scoreLoaded || appState === 'countdown'}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-150 ease-in-out disabled:cursor-not-allowed disabled:opacity-40 ${
                    isPlaybackActive
                      ? 'border-amber-accent/60 bg-amber-accent/20 text-amber-accent'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                  aria-label={isPlaybackActive ? 'Pause playback' : 'Play tab'}
                >
                  {isPlaybackActive ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <rect x="6" y="5" width="4" height="14" rx="1" />
                      <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {children}

            {!scoreLoaded && (
              <div className="absolute inset-0 z-10 bg-charcoal">
                <SongLibrary
                  songs={currentPlaySongs}
                  selectedSongId={activeSongId}
                  onSongSelect={onLoadSong}
                  onFileOpen={onOpenFile}
                  onClearAll={onClearAll}
                  onTestTab={onTestTab}
                />
              </div>
            )}
          </div>
        </div>

        <div
          className={`absolute inset-0 bg-charcoal transition-opacity duration-150 ease-in-out ${
            leftView === 'takesLibrary' ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <TakesLibraryView
            songs={songs}
            activeFilter={activeLibraryFilter}
            reviewSelection={reviewSelection}
            onFilterChange={onFilterChange}
            onRateTake={onRateTake}
            onDeleteTake={onDeleteTake}
            onPlayTake={onPlayTake}
            onExpandTake={onExpandTake}
          />
        </div>
      </div>
    </div>
  )
}
