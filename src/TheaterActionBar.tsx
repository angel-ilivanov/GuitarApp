import StarRating from './StarRating'

interface TheaterActionBarProps {
  take: Take
  onRate: (rating: number) => void
  onDelete: () => void
  onShowInFolder: () => void
}

export default function TheaterActionBar({ take, onRate, onDelete, onShowInFolder }: TheaterActionBarProps) {
  return (
    <div className="flex w-[70vw] items-center gap-4 rounded-b-lg border-t border-zinc-700/40 bg-charcoal-light px-4 py-2.5">
      <button
        onClick={onShowInFolder}
        className="flex cursor-pointer items-center gap-1.5 text-zinc-400 transition-colors duration-150 ease-in-out hover:text-zinc-200"
        aria-label="Show in folder"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="text-xs font-medium">Show in Folder</span>
      </button>

      <div className="flex flex-1 justify-center">
        <StarRating rating={take.rating ?? 0} onRate={onRate} />
      </div>

      <button
        onClick={onDelete}
        className="rounded p-1 text-zinc-500 transition-colors duration-150 ease-in-out hover:bg-red-400/10 hover:text-red-400"
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
}
