import { useEffect, useRef, useState, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'
import TabRenderer from './TabRenderer'

type AppState = 'idle' | 'countdown' | 'recording' | 'playing'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const alphaTabApiRef = useRef<alphaTab.AlphaTabApi | null>(null)

  const [appState, setAppState] = useState<AppState>('idle')
  const [countdown, setCountdown] = useState<number>(0)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  // Start camera on mount
  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch {
        setCameraError(true)
      }
    }
    initCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleApiReady = useCallback((api: alphaTab.AlphaTabApi) => {
    alphaTabApiRef.current = api
  }, [])

  const startCountdown = useCallback(() => {
    setAppState('countdown')
    setCountdown(4)

    let count = 4
    const interval = setInterval(() => {
      count--
      if (count === 0) {
        clearInterval(interval)
        setCountdown(0)
        // State B: Start recording + start AlphaTab playback
        if (streamRef.current) {
          const recorder = new MediaRecorder(streamRef.current, {
            mimeType: 'video/webm;codecs=vp9,opus',
          })
          chunksRef.current = []
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
          }
          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `guitar-take-${Date.now()}.webm`
            a.click()
            URL.revokeObjectURL(url)
          }
          recorderRef.current = recorder
          recorder.start()
        }
        // Start AlphaTab playback
        alphaTabApiRef.current?.play()
        setAppState('recording')
      } else {
        setCountdown(count)
      }
    }, 1000)
  }, [])

  const stopRecording = useCallback(() => {
    // State C: Stop recording + stop AlphaTab playback
    recorderRef.current?.stop()
    alphaTabApiRef.current?.stop()
    setAppState('idle')
  }, [])

  const togglePlay = useCallback(() => {
    if (appState === 'playing') {
      alphaTabApiRef.current?.pause()
      setAppState('idle')
    } else {
      alphaTabApiRef.current?.play()
      setAppState('playing')
    }
  }, [appState])

  return (
    <div className="h-dvh w-screen bg-slate-950 flex flex-col overflow-hidden select-none relative">
      {/* Top Half - Camera Viewport */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            Camera unavailable — check permissions
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          />
        )}
        {/* Camera viewport frame */}
        <div className="absolute inset-0 border border-zinc-700/50 pointer-events-none" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              appState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'
            }`}
          />
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
            {appState === 'recording' ? 'REC' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Center Floating Action Buttons */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-5">
        {/* Metronome Toggle */}
        <button
          onClick={() => setMetronomeOn(!metronomeOn)}
          className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
            metronomeOn
              ? 'bg-violet-500/30 border-violet-400/60 text-violet-300'
              : 'bg-zinc-800/70 border-zinc-600/50 text-zinc-400'
          }`}
          aria-label="Toggle metronome"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L8 22h8L12 2z" />
            <line x1="12" y1="8" x2="18" y2="4" />
          </svg>
        </button>

        {/* Record / Stop Button */}
        {appState === 'recording' ? (
          <button
            onClick={stopRecording}
            className="w-[72px] h-[72px] rounded-full bg-zinc-900/80 backdrop-blur-md border-2 border-red-500/80 flex items-center justify-center transition-all hover:border-red-400 active:scale-95"
            aria-label="Stop recording"
          >
            <div className="w-6 h-6 rounded-sm bg-red-500" />
          </button>
        ) : (
          <button
            onClick={startCountdown}
            disabled={appState === 'countdown' || appState === 'playing' || cameraError}
            className="w-[72px] h-[72px] rounded-full bg-zinc-900/80 backdrop-blur-md border-2 border-zinc-500/60 flex items-center justify-center transition-all hover:border-zinc-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Start recording"
          >
            <div className="w-6 h-6 rounded-full bg-red-500" />
          </button>
        )}

        {/* Play / Stop Tab Button */}
        <button
          onClick={togglePlay}
          disabled={appState === 'countdown' || appState === 'recording'}
          className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            appState === 'playing'
              ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-300'
              : 'bg-zinc-800/70 border-zinc-600/50 text-zinc-400'
          }`}
          aria-label={appState === 'playing' ? 'Stop playback' : 'Play tab'}
        >
          {appState === 'playing' ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom Half - Tablature Engine */}
      <div className="flex-1 bg-zinc-900 border-t border-zinc-800 overflow-hidden min-h-0">
        <TabRenderer onApiReady={handleApiReady} />
      </div>

      {/* Countdown Overlay */}
      {appState === 'countdown' && countdown > 0 && (
        <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <span
            key={countdown}
            className="text-[160px] font-bold text-white tabular-nums animate-[countPulse_1s_ease-out]"
          >
            {countdown}
          </span>
        </div>
      )}
    </div>
  )
}

export default App
