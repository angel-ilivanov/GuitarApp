import type { RefObject } from 'react'
import TheaterActionBar from './TheaterActionBar'
import { formatTakeDate, getTakeDisplayName, takeVideoUrl } from './takeUtils'

interface TheaterOverlayProps {
  take: Take | null
  songId: string | null
  videoRef: RefObject<HTMLVideoElement | null>
  onClose: () => void
  onRate: (songId: string, takeId: string, rating: number) => void
  onDelete: (songId: string, takeId: string) => void
  onShowInFolder: (filePath: string) => void
  onTakeMissing: (songId: string) => void
}

export default function TheaterOverlay({
  take,
  songId,
  videoRef,
  onClose,
  onRate,
  onDelete,
  onShowInFolder,
  onTakeMissing,
}: TheaterOverlayProps) {
  if (!take || !songId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-400 transition-all duration-150 ease-in-out hover:border-zinc-500 hover:text-white"
        aria-label="Close theater mode"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="absolute left-5 top-5 z-10">
        <p className="text-sm font-medium text-zinc-300">{getTakeDisplayName(take)}</p>
        <p className="text-xs font-mono text-zinc-500">{formatTakeDate(take.createdAt)} | {take.speed}% Speed</p>
      </div>

      <div className="flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <div className="relative aspect-video w-[70vw] overflow-hidden rounded-t-lg bg-black shadow-2xl">
          <video
            ref={videoRef}
            src={takeVideoUrl(take.filePath)}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => {
              onTakeMissing(songId)
              onClose()
            }}
          />
        </div>
        <TheaterActionBar
          take={take}
          onRate={(rating) => onRate(songId, take.id, rating)}
          onDelete={() => onDelete(songId, take.id)}
          onShowInFolder={() => onShowInFolder(take.filePath)}
        />
      </div>
    </div>
  )
}
