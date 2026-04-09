import { useEffect, useState } from 'react'
import { takeVideoUrl } from './takeUtils'

function generateThumbnail(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.src = takeVideoUrl(filePath)

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(0.5, video.duration || 0.5)
    })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      } catch {
        reject(new Error('Failed to draw thumbnail'))
      } finally {
        video.src = ''
        video.load()
      }
    })

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video for thumbnail'))
    })

    setTimeout(() => reject(new Error('Thumbnail generation timeout')), 5000)
  })
}

interface TakeThumbnailProps {
  filePath: string
  alt?: string
  className?: string
  onFileMissing?: () => void
}

export default function TakeThumbnail({
  filePath,
  alt = 'Take thumbnail',
  className = 'w-12 h-12 rounded-xl object-cover',
  onFileMissing,
}: TakeThumbnailProps) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    generateThumbnail(filePath)
      .then((url) => {
        if (!cancelled) {
          setThumb(url)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          onFileMissing?.()
        }
      })

    return () => {
      cancelled = true
    }
  }, [filePath, onFileMissing])

  if (failed) {
    return (
      <div
        className={`${className} flex items-center justify-center border border-red-900/50 bg-red-950/40`}
        title="File missing"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-red-500/70" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  if (thumb) {
    return <img src={thumb} alt={alt} className={className} />
  }

  return (
    <div className={`${className} flex items-center justify-center border border-zinc-700 bg-zinc-900`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
      </svg>
    </div>
  )
}
