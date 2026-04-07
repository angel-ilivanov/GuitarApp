import { useState } from 'react'

interface TheaterActionBarProps {
  take: Take
  onRate: (rating: number) => void
  onDelete: () => void
  onShowInFolder: () => void
}

export default function TheaterActionBar({ take, onRate, onDelete, onShowInFolder }: TheaterActionBarProps) {
  const [hoverRating, setHoverRating] = useState(0)
  const displayRating = hoverRating || (take.rating ?? 0)

  return (
    <div className="w-[70vw] flex items-center gap-4 px-4 py-2.5 bg-charcoal-light border-t border-zinc-700/40 rounded-b-lg">
      {/* Show in Folder */}
      <button
        onClick={onShowInFolder}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
        aria-label="Show in folder"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
        <span className="text-xs font-medium">Show in Folder</span>
      </button>

      {/* Star Rating — centered */}
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= displayRating
            return (
              <button
                key={star}
                onClick={() => onRate(star === take.rating ? 0 : star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-5 w-5 transition-all duration-300 ${
                    filled
                      ? 'fill-amber-accent text-amber-accent'
                      : 'fill-none text-zinc-600'
                  }`}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={filled ? {
                    filter: 'drop-shadow(0 0 4px rgba(255,183,3,0.5))',
                  } : undefined}
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
        aria-label="Delete take"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>
    </div>
  )
}
