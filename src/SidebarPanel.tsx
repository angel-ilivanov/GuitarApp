import type { RefObject } from 'react'
import TakeThumbnail from './TakeThumbnail'
import StarRating from './StarRating'
import { formatTakeDate, getTakeDisplayName, takeVideoUrl } from './takeUtils'
import type { SidebarMode } from './librarySelectors'

interface ReviewSelection {
  songId: string
  takeId: string
}

interface SidebarPanelProps {
  sidebarMode: SidebarMode
  appState: 'idle' | 'countdown' | 'recording' | 'playing'
  cameraError: string | false
  scoreLoaded: boolean
  activeSongId: string
  activeSong: Song | null
  reviewSong: Song | null
  reviewTake: Take | null
  reviewSelection: ReviewSelection | null
  sidebarTakes: Take[]
  reviewIsPlaying: boolean
  reviewCurrentTime: number
  reviewDuration: number
  playbackSpeed: number
  masterVolume: number
  metronomeOn: boolean
  countInEnabled: boolean
  isPlaybackActive: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  reviewVideoRef: RefObject<HTMLVideoElement | null>
  onOpenReview: (songId: string, takeId: string) => void
  onRateTake: (songId: string, takeId: string, rating: number) => void
  onDeleteTake: (songId: string, takeId: string) => void
  onRefreshSongTakes: (songId: string) => void
  onStartCountdown: () => void
  onStopRecording: () => void
  onTogglePlay: () => void
  onToggleMetronome: () => void
  onToggleCountIn: () => void
  onSetPlaybackSpeed: (value: number) => void
  onSetMasterVolume: (value: number) => void
  onOpenTheater: (songId: string, takeId: string) => void
  onExitReview: () => void
  onShowTakeInFolder: (filePath: string) => void
}

function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'

  const wholeSeconds = Math.floor(seconds)
  const minutes = Math.floor(wholeSeconds / 60)
  const remainder = wholeSeconds % 60

  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function buildSliderBackground(value: number, max: number): string {
  const safeMax = max <= 0 ? 1 : max
  const percentage = Math.max(0, Math.min(100, (value / safeMax) * 100))
  return `linear-gradient(90deg, #E09800 0%, #FFB703 ${percentage}%, #2a2a2a ${percentage}%, #2a2a2a 100%)`
}

export default function SidebarPanel({
  sidebarMode,
  appState,
  cameraError,
  scoreLoaded,
  activeSongId,
  activeSong,
  reviewSong,
  reviewTake,
  reviewSelection,
  sidebarTakes,
  reviewIsPlaying,
  reviewCurrentTime,
  reviewDuration,
  playbackSpeed,
  masterVolume,
  metronomeOn,
  countInEnabled,
  isPlaybackActive,
  videoRef,
  reviewVideoRef,
  onOpenReview,
  onRateTake,
  onDeleteTake,
  onRefreshSongTakes,
  onStartCountdown,
  onStopRecording,
  onTogglePlay,
  onToggleMetronome,
  onToggleCountIn,
  onSetPlaybackSpeed,
  onSetMasterVolume,
  onOpenTheater,
  onExitReview,
  onShowTakeInFolder,
}: SidebarPanelProps) {
  const sidebarSong = sidebarMode === 'reviewing' ? reviewSong : activeSong

  return (
    <div className="flex flex-col overflow-hidden border-l border-zinc-800 bg-charcoal-light">
      <div className="shrink-0 border-b border-zinc-800 px-4 py-2.5 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">GuitarApp</span>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {sidebarMode === 'reviewing' ? 'Take Preview' : 'Live Feed'}
          </span>
          <span className="text-[10px] font-mono uppercase text-zinc-600">
            {sidebarMode === 'reviewing'
              ? `Song: ${(reviewSong?.title || 'Selected Take').slice(0, 16)}`
              : 'Active: User'}
          </span>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black">
          {sidebarMode === 'reviewing' && reviewTake ? (
            <>
              <video
                key="review-video"
                ref={reviewVideoRef}
                src={takeVideoUrl(reviewTake.filePath)}
                className="absolute inset-0 h-full w-full object-contain"
                onError={() => {
                  if (reviewSelection) {
                    onRefreshSongTakes(reviewSelection.songId)
                  }
                  onExitReview()
                }}
              />
              <div className="absolute left-2 top-2 rounded-full border border-amber-accent/35 bg-black/55 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.28em] text-amber-accent">
                Reviewing
              </div>
            </>
          ) : cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs text-zinc-500">
              <span>Camera unavailable</span>
              <code className="text-[10px] text-red-400">{cameraError}</code>
            </div>
          ) : (
            <>
              <video
                key="live-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
              />
              <div className="absolute left-2 top-2 flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${appState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">
                  {appState === 'recording' ? 'REC' : 'LIVE'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 pt-4">
        <span className="mb-3 block text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {sidebarMode === 'reviewing' ? 'Review Deck' : 'Control Deck'}
        </span>

        {sidebarMode === 'reviewing' && reviewTake && reviewSelection ? (
          <div className="flex flex-col gap-4" data-testid="review-deck">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/35 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{getTakeDisplayName(reviewTake)}</p>
                  <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    {formatTakeDate(reviewTake.createdAt)}
                  </p>
                </div>
                <StarRating
                  rating={reviewTake.rating ?? 0}
                  size="sm"
                  onRate={(rating) => onRateTake(reviewSelection.songId, reviewTake.id, rating)}
                />
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">scrub</span>
                  <span className="text-[10px] font-mono text-amber-accent">
                    {formatMediaTime(reviewCurrentTime)} / {formatMediaTime(reviewDuration)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={reviewDuration || 0}
                  step="0.01"
                  value={Math.min(reviewCurrentTime, reviewDuration || 0)}
                  onChange={(event) => {
                    const nextTime = Number(event.target.value)
                    if (reviewVideoRef.current) {
                      reviewVideoRef.current.currentTime = nextTime
                    }
                  }}
                  className="amber-slider w-full"
                  style={{ background: buildSliderBackground(reviewCurrentTime, reviewDuration || 1) }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!reviewVideoRef.current) return
                  if (reviewVideoRef.current.paused) {
                    void reviewVideoRef.current.play()
                  } else {
                    reviewVideoRef.current.pause()
                  }
                }}
                className="flex h-11 items-center gap-2 rounded-full border-2 border-amber-accent bg-amber-accent/10 px-5 text-xs font-bold tracking-wider text-amber-accent transition-all duration-150 ease-in-out hover:bg-amber-accent/18"
              >
                {reviewIsPlaying ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                  </svg>
                )}
                <span>{reviewIsPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenTheater(reviewSelection.songId, reviewTake.id)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-300 transition-all duration-150 ease-in-out hover:border-zinc-500 hover:text-zinc-100"
              >
                Expand
              </button>

              <button
                type="button"
                onClick={() => onShowTakeInFolder(reviewTake.filePath)}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-300 transition-all duration-150 ease-in-out hover:border-zinc-500 hover:text-zinc-100"
              >
                Export
              </button>

              <button
                type="button"
                onClick={onExitReview}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400 transition-all duration-150 ease-in-out hover:border-zinc-500 hover:text-zinc-100"
              >
                Live
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3">
              <select className="pill-select cursor-pointer rounded-full border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs text-zinc-300 focus:border-amber-accent/50 focus:outline-none">
                <option>Tuner: E STANDARD</option>
                <option>Tuner: DROP D</option>
                <option>Tuner: D STANDARD</option>
                <option>Tuner: OPEN G</option>
              </select>

              <select className="pill-select cursor-pointer rounded-full border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs text-zinc-300 focus:border-amber-accent/50 focus:outline-none">
                <option>Input: Primary Audio</option>
                <option>Input: USB Interface</option>
                <option>Input: Webcam Mic</option>
              </select>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">speed</span>
                  <span className="text-[10px] font-semibold tracking-widest text-amber-accent">{Math.round(playbackSpeed * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(playbackSpeed * 100)}
                  onChange={(event) => onSetPlaybackSpeed(Number(event.target.value) / 100)}
                  className="amber-slider w-full"
                  style={{ background: buildSliderBackground(playbackSpeed * 100, 100) }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">volume</span>
                  <span className="text-[10px] font-semibold tracking-widest text-amber-accent">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(masterVolume * 100)}
                  onChange={(event) => onSetMasterVolume(Number(event.target.value) / 100)}
                  className="amber-slider w-full"
                  style={{ background: buildSliderBackground(masterVolume * 100, 100) }}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {appState === 'recording' ? (
                <button
                  type="button"
                  onClick={onStopRecording}
                  className="flex h-11 items-center gap-2 rounded-full border-2 border-red-500/80 bg-charcoal px-5 transition-all duration-150 ease-in-out hover:border-red-400"
                  aria-label="Stop recording"
                >
                  <div className="h-3.5 w-3.5 rounded-sm bg-red-500" />
                  <span className="text-xs font-bold tracking-wider text-red-500">RECORD</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartCountdown}
                  disabled={appState === 'countdown' || !!cameraError || !scoreLoaded || !activeSongId}
                  className="animate-glowAmber flex h-11 items-center gap-2 rounded-full border-2 border-amber-accent bg-amber-accent/10 px-5 transition-all duration-150 ease-in-out hover:bg-amber-accent/20 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Start recording"
                >
                  <div className="h-3 w-3 rounded-full bg-amber-accent" />
                  <span className="text-xs font-bold tracking-wider text-amber-accent">RECORD</span>
                </button>
              )}

              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!scoreLoaded || appState === 'countdown'}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 ease-in-out disabled:cursor-not-allowed disabled:opacity-30 ${
                  isPlaybackActive
                    ? 'border-amber-accent/50 bg-amber-accent/20 text-amber-accent'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
                aria-label={isPlaybackActive ? 'Pause playback' : 'Play tab'}
              >
                {isPlaybackActive ? (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                    <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onToggleMetronome}
                disabled={!scoreLoaded}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 ease-in-out disabled:cursor-not-allowed disabled:opacity-30 ${
                  metronomeOn
                    ? 'border-amber-accent/50 bg-amber-accent/20 text-amber-accent'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
                aria-label="Toggle metronome"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L8 22h8L12 2z" />
                  <line x1="12" y1="8" x2="18" y2="4" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onToggleCountIn}
                disabled={!scoreLoaded}
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-150 ease-in-out disabled:cursor-not-allowed disabled:opacity-30 ${
                  countInEnabled
                    ? 'border-amber-accent/50 bg-amber-accent/20 text-amber-accent'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}
                aria-label="Toggle count-in"
                title={countInEnabled ? 'Count-in: ON' : 'Count-in: OFF'}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v6l4 2" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-4">
        <div className="mb-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Takes Vault ({sidebarTakes.length})
          </span>
          {sidebarSong && (
            <p className="mt-1 truncate text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-600">
              {sidebarSong.title || 'Current Song'}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {sidebarTakes.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-600">
              {sidebarMode === 'reviewing' ? 'No takes for this song' : 'No takes yet'}
            </p>
          ) : (
            sidebarSong && sidebarTakes.map((take) => {
              const selected = reviewSelection?.songId === sidebarSong.id && reviewSelection.takeId === take.id

              return (
                <div
                  key={take.id}
                  onClick={() => onOpenReview(sidebarSong.id, take.id)}
                  className={`group flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-all duration-150 ease-in-out ${
                    selected
                      ? 'border-amber-accent/45 bg-amber-accent/10'
                      : 'border-zinc-800 bg-zinc-800/40 hover:border-zinc-700 hover:bg-zinc-800/60'
                  }`}
                >
                  <TakeThumbnail
                    filePath={take.filePath}
                    className="h-10 w-10 rounded object-cover"
                    onFileMissing={() => {
                      onRefreshSongTakes(sidebarSong.id)
                    }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-zinc-300">{getTakeDisplayName(take)}</p>
                    <p className="text-[10px] font-mono text-zinc-500">{formatTakeDate(take.createdAt)}</p>
                    <p className="text-[10px] font-mono text-zinc-600">{take.speed}% Speed</p>
                  </div>

                  <div className={`shrink-0 flex items-center gap-1 font-mono text-[11px] ${take.rating ? 'text-amber-accent' : 'text-zinc-600'}`}>
                    <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${take.rating ? 'fill-amber-accent' : 'fill-none'}`} stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>{take.rating ? `${take.rating}/5` : '--'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteTake(sidebarSong.id, take.id)
                    }}
                    className="shrink-0 text-zinc-600 opacity-0 transition-all duration-150 ease-in-out group-hover:opacity-100 hover:scale-110 hover:text-red-500"
                    aria-label="Delete take"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
