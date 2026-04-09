import { useState, useEffect, useRef, useCallback } from 'react'

interface TakeToastProps {
  defaultName: string
  onRename: (newName: string) => void
  onRate: (score: number) => void
  onDelete: () => void
  onFavorite: (isFavorite: boolean) => void
  onDismiss: () => void
  duration?: number
}

export default function TakeToast({
  defaultName,
  onRename,
  onRate,
  onDelete,
  onFavorite,
  onDismiss,
  duration = 10000,
}: TakeToastProps) {
  const [name, setName] = useState(defaultName)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [isFavorite, setIsFavorite] = useState(false)
  const [progress, setProgress] = useState(100)
  const [flashDelete, setFlashDelete] = useState(false)
  const [flashRating, setFlashRating] = useState(0)
  const [fading, setFading] = useState(false)

  const nameRef = useRef(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)
  const isPausedRef = useRef(false)
  const elapsedRef = useRef(0)
  const lastFrameRef = useRef(0)
  const rafRef = useRef<number>(0)
  const dismissedRef = useRef(false)

  useEffect(() => {
    const tick = (now: number) => {
      if (dismissedRef.current) return
      if (lastFrameRef.current === 0) lastFrameRef.current = now

      if (!isPausedRef.current) {
        elapsedRef.current += now - lastFrameRef.current
      }
      lastFrameRef.current = now

      const pct = Math.max(0, 100 - (elapsedRef.current / duration) * 100)
      setProgress(pct)

      if (pct <= 0) {
        dismissedRef.current = true
        onRename(nameRef.current)
        onDismiss()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [duration, onDismiss, onRename])

  // --- Pause / resume helpers ---
  const pause = useCallback(() => {
    isPausedRef.current = true
  }, [])
  const resume = useCallback(() => {
    isPausedRef.current = false
    lastFrameRef.current = 0 // reset delta so we don't count paused time
  }, [])

  // --- Flash then dismiss helpers ---
  const flashAndDelete = useCallback(() => {
    if (dismissedRef.current) return
    setFlashDelete(true)
    setTimeout(() => setFading(true), 200)
    setTimeout(() => {
      dismissedRef.current = true
      cancelAnimationFrame(rafRef.current)
      onDelete()
    }, 500)
  }, [onDelete])

  const flashAndRate = useCallback((score: number) => {
    setRating(score)
    setFlashRating(score)
    onRate(score)
    setTimeout(() => setFading(true), 250)
    setTimeout(() => {
      dismissedRef.current = true
      cancelAnimationFrame(rafRef.current)
      onRename(nameRef.current)
      onDismiss()
    }, 550)
  }, [onRate, onRename, onDismiss])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in the input
      if (document.activeElement === inputRef.current) return

      if (e.key === 'Enter') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        return
      }
      if (e.key >= '1' && e.key <= '5') {
        flashAndRate(Number(e.key))
      }
      if (e.key === 'Delete') {
        flashAndDelete()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flashAndRate, flashAndDelete])

  // --- Handlers ---
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation()
      onRename(name)
      inputRef.current?.blur()
    }
  }

  const handleStarClick = (score: number) => {
    flashAndRate(score)
  }

  const handleDelete = () => {
    flashAndDelete()
  }

  const handleFavorite = () => {
    const next = !isFavorite
    setIsFavorite(next)
    onFavorite(next)
  }

  // Stars to render
  const displayRating = hoverRating || rating

  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] w-[310px] animate-[slideInRight_0.3s_ease-out] overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-900/90 shadow-2xl backdrop-blur-md transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      {/* Content */}
      <div className="flex flex-col gap-2.5 p-4">
        {/* Title / Rename input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); nameRef.current = e.target.value }}
          onKeyDown={handleInputKeyDown}
          onFocus={pause}
          onBlur={() => {
            onRename(name)
            resume()
          }}
          className="w-full rounded-lg border border-zinc-700/40 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-accent/50"
          spellCheck={false}
        />

        {/* Star rating row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= displayRating
              const isGlowing = flashRating > 0 && star <= flashRating
              return (
                <button
                  key={star}
                  onClick={() => handleStarClick(star)}
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
                    style={isGlowing ? {
                      filter: 'drop-shadow(0 0 6px rgba(255,183,3,0.8)) drop-shadow(0 0 12px rgba(255,183,3,0.5))',
                    } : undefined}
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              )
            })}
          </div>
          <span className="shrink-0 font-mono text-[10px] text-zinc-600">[1-5]</span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className={`flex items-center gap-1 transition-all duration-200 ${
                flashDelete
                  ? 'text-red-400 scale-110'
                  : 'text-zinc-500 hover:text-red-400'
              }`}
              aria-label="Delete take"
              style={flashDelete ? {
                filter: 'drop-shadow(0 0 6px rgba(248,113,113,0.8))',
              } : undefined}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
              </svg>
              <span className="font-mono text-[10px]">[Del]</span>
            </button>

            <button
              onClick={handleFavorite}
              className={`transition-all hover:scale-110 ${
                isFavorite ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="Toggle favorite"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4.5 w-4.5"
                fill={isFavorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="h-[2px] w-full bg-transparent">
        <div
          className="h-full bg-amber-accent shadow-[0_0_6px_rgba(255,183,3,0.6)] transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
