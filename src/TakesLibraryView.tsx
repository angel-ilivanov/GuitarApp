import { useMemo, useState } from 'react'
import type { LibraryFilter } from './librarySelectors'
import { getSongsForLibrary } from './librarySelectors'
import { getSongArtworkBackground } from './songArtwork'
import StarRating from './StarRating'
import TakeThumbnail from './TakeThumbnail'
import { formatTakeDate, getTakeDisplayName } from './takeUtils'

interface ReviewSelection {
  songId: string
  takeId: string
}

interface TakesLibraryViewProps {
  songs: Song[]
  activeFilter: LibraryFilter
  reviewSelection: ReviewSelection | null
  onFilterChange: (filter: LibraryFilter) => void
  onRateTake: (songId: string, takeId: string, rating: number) => void
  onDeleteTake: (songId: string, takeId: string) => void
  onPlayTake: (songId: string, takeId: string) => void
  onExpandTake: (songId: string, takeId: string) => void
}

const FILTER_PILLS: Array<{ id: Exclude<LibraryFilter, 'none'>; label: string }> = [
  { id: 'fiveStars', label: '5 Stars' },
  { id: 'fourPlus', label: '4+ Stars' },
  { id: 'mostRecent', label: 'Most Recent' },
]

function getFilterTitle(filter: LibraryFilter): string {
  switch (filter) {
    case 'fiveStars':
      return '5-star takes'
    case 'fourPlus':
      return '4+ star takes'
    case 'mostRecent':
      return 'recent takes'
    case 'none':
    default:
      return 'takes'
  }
}

function EmptyLibraryState({ filter, onReset }: { filter: LibraryFilter; onReset: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/30 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-accent/30 bg-amber-accent/8">
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-accent" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="M8 11l4 4 4-4" />
          <path d="M5 19h14" />
        </svg>
      </div>
      <h2 className="mt-5 text-xl font-medium text-zinc-100">No matching takes</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
        Nothing in the library matches the current {getFilterTitle(filter)} filter. Clear the pill to bring the full vault back.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-full border border-amber-accent/40 bg-amber-accent/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-accent transition-all duration-150 ease-in-out hover:bg-amber-accent/18"
      >
        Show All Takes
      </button>
    </div>
  )
}

export default function TakesLibraryView({
  songs,
  activeFilter,
  reviewSelection,
  onFilterChange,
  onRateTake,
  onDeleteTake,
  onPlayTake,
  onExpandTake,
}: TakesLibraryViewProps) {
  const [manualExpandedSongIds, setManualExpandedSongIds] = useState<Set<string>>(new Set())
  const songGroups = useMemo(() => getSongsForLibrary(songs, activeFilter), [songs, activeFilter])
  const expandedSongIds = useMemo(() => {
    const next = new Set(manualExpandedSongIds)
    if (reviewSelection) {
      next.add(reviewSelection.songId)
    }
    return next
  }, [manualExpandedSongIds, reviewSelection])

  const toggleExpanded = (songId: string) => {
    setManualExpandedSongIds((current) => {
      const next = new Set(current)
      if (next.has(songId)) {
        next.delete(songId)
      } else {
        next.add(songId)
      }
      return next
    })
  }

  return (
    <div className="flex h-full flex-col px-8 pb-8 pt-6">
      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onFilterChange(active ? 'none' : pill.id)}
                className={`rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] transition-all duration-150 ease-in-out ${
                  active
                    ? 'border-amber-accent/70 bg-amber-accent text-charcoal shadow-[0_0_18px_rgba(255,183,3,0.22)]'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-amber-accent/35 hover:text-zinc-200'
                }`}
              >
                {pill.label}
              </button>
            )
          })}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light italic tracking-wide text-zinc-100" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              Takes Library
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Review every recorded pass, filter the strongest takes, and jump into playback without leaving the workspace.</p>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-[0.28em] text-zinc-600">
            {songGroups.reduce((count, group) => count + group.visibleTakes.length, 0)} visible takes
          </p>
        </div>
      </div>

      <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-2">
        {songGroups.length === 0 ? (
          <EmptyLibraryState filter={activeFilter} onReset={() => onFilterChange('none')} />
        ) : (
          <div className="space-y-4">
            {songGroups.map(({ song, visibleTakes }) => {
              const expanded = expandedSongIds.has(song.id)

              return (
                <section
                  key={song.id}
                  className="overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/35 transition-colors duration-150 ease-in-out hover:border-zinc-700"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(song.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-800">
                      {song.albumArt ? (
                        <img src={song.albumArt} alt={`${song.title} cover`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" style={{ background: getSongArtworkBackground(song.id) }} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-zinc-100">{song.title || 'Untitled'}</p>
                      <p className="mt-1 truncate text-sm text-zinc-500">{song.artist || 'Unknown Artist'}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="rounded-full border border-amber-accent/30 bg-amber-accent/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-accent">
                        {visibleTakes.length} {visibleTakes.length === 1 ? 'Take' : 'Takes'}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        className={`h-4 w-4 text-zinc-500 transition-transform duration-150 ease-in-out ${expanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-150 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-zinc-800/80 px-5 py-3">
                        <div className="space-y-2">
                          {visibleTakes.map((take) => {
                            const selected = reviewSelection?.songId === song.id && reviewSelection.takeId === take.id

                            return (
                              <div
                                key={take.id}
                                role="button"
                                tabIndex={0}
                                data-testid={`take-row-${song.id}-${take.id}`}
                                onClick={() => onPlayTake(song.id, take.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    onPlayTake(song.id, take.id)
                                  }
                                }}
                                className={`group flex items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-150 ease-in-out ${
                                  selected
                                    ? 'border-amber-accent/45 bg-amber-accent/8'
                                    : 'border-transparent bg-zinc-950/30 hover:border-zinc-800 hover:bg-zinc-900/55'
                                } cursor-pointer`}
                              >
                                <TakeThumbnail filePath={take.filePath} className="h-12 w-12 rounded-xl object-cover" />

                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-zinc-100">{getTakeDisplayName(take)}</p>
                                  <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                                    {formatTakeDate(take.createdAt)}
                                  </p>
                                </div>

                                <div className="ml-auto flex items-center gap-4">
                                  <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                                    <StarRating
                                      rating={take.rating ?? 0}
                                      size="sm"
                                      onRate={(rating) => onRateTake(song.id, take.id, rating)}
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 ease-in-out group-hover:opacity-100 group-focus-within:opacity-100">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        onExpandTake(song.id, take.id)
                                      }}
                                      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-300 transition-all duration-150 ease-in-out hover:border-zinc-500 hover:text-zinc-100"
                                    >
                                      Expand
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        onDeleteTake(song.id, take.id)
                                      }}
                                      className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400 transition-all duration-150 ease-in-out hover:border-red-400/45 hover:text-red-300"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
