import { useState } from 'react'

type StarTone = 'active' | 'pending-add' | 'pending-remove' | 'inactive'

function getStarTone(star: number, rating: number, hoverRating: number | null): StarTone {
  if (hoverRating === null || hoverRating === rating) {
    return star <= rating ? 'active' : 'inactive'
  }

  if (hoverRating > rating) {
    if (star <= rating) return 'active'
    if (star <= hoverRating) return 'pending-add'
    return 'inactive'
  }

  if (star <= hoverRating) return 'active'
  if (star <= rating) return 'pending-remove'
  return 'inactive'
}

function getStarStyle(tone: StarTone): React.CSSProperties {
  switch (tone) {
    case 'active':
      return {
        color: '#FFB703',
        filter: 'drop-shadow(0 0 5px rgba(255, 183, 3, 0.45))',
      }
    case 'pending-add':
      return {
        color: 'rgba(255, 183, 3, 0.65)',
        filter: 'drop-shadow(0 0 4px rgba(255, 183, 3, 0.2))',
      }
    case 'pending-remove':
      return {
        color: 'rgba(255, 183, 3, 0.4)',
      }
    case 'inactive':
    default:
      return {
        color: 'rgba(113, 113, 122, 0.9)',
      }
  }
}

interface StarRatingProps {
  rating?: number
  onRate?: (rating: number) => void
  allowClear?: boolean
  size?: 'sm' | 'md'
  className?: string
  disabled?: boolean
}

export default function StarRating({
  rating = 0,
  onRate,
  allowClear = true,
  size = 'md',
  className = '',
  disabled = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const iconClassName = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  const nextRating = hoverRating ?? rating

  return (
    <div className={`flex items-center gap-0.5 ${className}`} aria-label={`Rating: ${nextRating} of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const tone = getStarTone(star, rating, hoverRating)
        const filled = tone !== 'inactive'

        return (
          <button
            key={star}
            type="button"
            disabled={disabled || !onRate}
            onClick={() => onRate?.(allowClear && star === rating ? 0 : star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            className="rounded p-0.5 transition-transform duration-150 ease-in-out hover:scale-105 disabled:cursor-default disabled:hover:scale-100"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`${iconClassName} transition-all duration-150 ease-in-out`}
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              style={getStarStyle(tone)}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
