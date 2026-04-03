import { useEffect, useRef, useState, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'
import TabRenderer from './TabRenderer'
import type { TabRendererHandle } from './TabRenderer'
import TakeToast from './TakeToast'

type AppState = 'idle' | 'countdown' | 'recording' | 'playing'

/** Convert a local file path to a take-video:// URL for Electron playback */
function takeVideoUrl(filePath: string): string {
  // Normalize backslashes to forward slashes and encode
  const normalized = filePath.replace(/\\/g, '/')
  return `take-video://file/${encodeURIComponent(normalized)}`
}

/** Generates a thumbnail data URL from a .webm video by seeking to 0.5s */
function generateThumbnail(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.src = takeVideoUrl(filePath)

    video.addEventListener('loadeddata', () => {
      // Seek to 0.5s to avoid a black first frame
      video.currentTime = Math.min(0.5, video.duration || 0.5)
    })

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(dataUrl)
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

    // Timeout fallback
    setTimeout(() => reject(new Error('Thumbnail generation timeout')), 5000)
  })
}

/** Small component that lazily generates and displays a video thumbnail */
function TakeThumbnail({ filePath, onFileMissing }: { filePath: string; onFileMissing?: () => void }) {
  const [thumb, setThumb] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    generateThumbnail(filePath)
      .then((url) => { if (!cancelled) setThumb(url) })
      .catch(() => {
        if (!cancelled) {
          console.warn('Thumbnail failed — file may be missing:', filePath)
          setFailed(true)
          onFileMissing?.()
        }
      })
    return () => { cancelled = true }
  }, [filePath, onFileMissing])

  if (failed) {
    return (
      <div className="w-10 h-10 rounded bg-red-950/40 border border-red-900/50 flex items-center justify-center" title="File missing">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-500/70" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </div>
    )
  }

  if (thumb) {
    return <img src={thumb} alt="Take thumbnail" className="w-10 h-10 rounded object-cover" />
  }

  // Fallback icon while loading
  return (
    <div className="w-10 h-10 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
      </svg>
    </div>
  )
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const alphaTabApiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const tabRendererRef = useRef<TabRendererHandle>(null)

  const [appState, setAppState] = useState<AppState>('idle')
  const [countdown, setCountdown] = useState<number>(0)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [cameraError, setCameraError] = useState<string | false>(false)
  const [scoreLoaded, setScoreLoaded] = useState(false)
  const [songFilename, setSongFilename] = useState('')
  const [recentSongs, setRecentSongs] = useState<RecentSong[]>([])
  const [takes, setTakes] = useState<Take[]>([])
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [bpm, setBpm] = useState(0)
  const [timeSig, setTimeSig] = useState('')

  // Toast notification state
  const [toastTake, setToastTake] = useState<Take | null>(null)

  // Theater Mode state
  const [theaterTake, setTheaterTake] = useState<Take | null>(null)
  const theaterVideoRef = useRef<HTMLVideoElement>(null)

  // Start camera on mount
  useEffect(() => {
    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
          },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        console.error('getUserMedia failed:', e)
        setCameraError(`${e.name}: ${e.message}`)
      }
    }
    initCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Fetch recent songs on mount
  useEffect(() => {
    window.electronAPI?.getRecentSongs().then(setRecentSongs)
  }, [])

  const loadTakes = useCallback((filename: string) => {
    if (filename) {
      window.electronAPI?.getTakesForSong(filename).then(setTakes)
    }
  }, [])

  const extractScoreInfo = useCallback(() => {
    const api = alphaTabApiRef.current
    const score = api?.score
    if (score) {
      setBpm(score.tempo)
      const mb = score.masterBars?.[0]
      if (mb) {
        setTimeSig(`${mb.timeSignatureNumerator}/${mb.timeSignatureDenominator}`)
      }
    }
  }, [])

  const handleApiReady = useCallback((api: alphaTab.AlphaTabApi) => {
    alphaTabApiRef.current = api
  }, [])

  const handleFileOpened = useCallback((fileName: string, filePath: string, title: string, artist: string) => {
    setSongFilename(fileName)
    setSongTitle(title)
    setSongArtist(artist)
    window.electronAPI?.updateSongMeta(fileName, title, artist)
    window.electronAPI?.getRecentSongs().then(setRecentSongs)
    loadTakes(fileName)
    setTimeout(() => {
      extractScoreInfo()
      // Register the song in the library with BPM from the parsed score
      const scoreBpm = alphaTabApiRef.current?.score?.tempo ?? 0
      window.electronAPI?.addNewSong(filePath, title, artist, scoreBpm).then((songObj) => {
        console.log('Song added to library:', songObj)
      })
    }, 100)
  }, [loadTakes, extractScoreInfo])

  const handleLoadRecent = useCallback(async (song: RecentSong) => {
    const result = await window.electronAPI!.loadRecentFile(song.gpFilePath, song.songFilename)
    if (result.error === 'file_not_found') {
      alert('File no longer exists at the saved location.')
      return
    }
    if (result.error) {
      alert('Failed to read file.')
      return
    }
    setSongFilename(song.songFilename)
    const meta = tabRendererRef.current?.loadFromBuffer(new Uint8Array(result.buffer!), song.songFilename)
    if (meta) {
      setSongTitle(meta.title)
      setSongArtist(meta.artist)
      window.electronAPI?.updateSongMeta(song.songFilename, meta.title, meta.artist)
    }
    window.electronAPI?.getRecentSongs().then(setRecentSongs)
    loadTakes(song.songFilename)
    setTimeout(extractScoreInfo, 100)
  }, [loadTakes, extractScoreInfo])

  const playTick = useCallback((isFirst: boolean) => {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = isFirst ? 1000 : 800
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.08)
    osc.onended = () => ctx.close()
  }, [])

  const startCountdown = useCallback(() => {
    const api = alphaTabApiRef.current
    const score = api?.score
    const scoreBpm = score?.tempo ?? 120
    const beats = score?.masterBars?.[0]?.timeSignatureNumerator ?? 4
    const msPerBeat = 60000 / scoreBpm

    setAppState('countdown')
    setCountdown(beats)
    playTick(true)

    let remaining = beats
    const interval = setInterval(() => {
      remaining--
      if (remaining === 0) {
        clearInterval(interval)
        setCountdown(0)
        if (streamRef.current) {
          const recorder = new MediaRecorder(streamRef.current, {
            mimeType: 'video/webm;codecs=vp9,opus',
          })
          chunksRef.current = []
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
          }
          recorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' })
            const buffer = await blob.arrayBuffer()
            const result = await window.electronAPI!.saveVideoTake(buffer, songFilename, songTitle)
            if (result.success) {
              console.log('Take saved:', result.path, result.take)
              if (result.take) {
                const freshTakes = await window.electronAPI!.getTakesForSong(songFilename)
                setTakes(freshTakes)
                setToastTake(result.take)
              }
            }
          }
          recorderRef.current = recorder
          recorder.start()
        }
        alphaTabApiRef.current?.play()
        setAppState('recording')
      } else {
        playTick(false)
        setCountdown(remaining)
      }
    }, msPerBeat)
  }, [songFilename, playTick, loadTakes])

  const stopRecording = useCallback(() => {
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

  const toggleMetronome = useCallback(() => {
    const next = !metronomeOn
    setMetronomeOn(next)
    if (alphaTabApiRef.current) {
      alphaTabApiRef.current.metronomeVolume = next ? 1 : 0
    }
  }, [metronomeOn])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape' && theaterTake) {
        setTheaterTake(null)
      }
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        if (appState === 'recording') {
          stopRecording()
        } else if (appState === 'idle' && scoreLoaded && !cameraError) {
          startCountdown()
        }
      }
      if (e.key === 'Enter') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [theaterTake, appState, scoreLoaded, cameraError, startCountdown, stopRecording])

  const handleSongClosed = useCallback(() => {
    recorderRef.current?.stop()
    alphaTabApiRef.current?.stop()
    setAppState('idle')
    setScoreLoaded(false)
    setSongTitle('')
    setSongArtist('')
    setBpm(0)
    setTimeSig('')
    setTakes([])
  }, [])

  const closeTheater = useCallback(() => {
    setTheaterTake(null)
  }, [])

  return (
    <div className="h-dvh w-screen bg-charcoal grid grid-cols-[75%_25%] overflow-hidden select-none relative">

      {/* ═══════════════════════════════════════════════════════ */}
      {/* LEFT COLUMN — Song Header + Tablature                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col overflow-hidden min-h-0">

        {/* Song Header */}
        {scoreLoaded && (
          <div className="shrink-0 px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h1 className="text-zinc-100 text-sm font-semibold tracking-wide uppercase">
                {songArtist && <>{songArtist} — </>}"{songTitle || songFilename}"
              </h1>
              <div className="flex items-center gap-4 mt-0.5">
                <span className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                  BPM: {bpm || '—'}
                </span>
                <span className="text-zinc-500 text-[11px] font-mono uppercase tracking-wider">
                  Time Sig: {timeSig || '—'}
                </span>
              </div>
            </div>
            <button
              onClick={togglePlay}
              disabled={!scoreLoaded || appState === 'countdown' || appState === 'recording'}
              className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                appState === 'playing'
                  ? 'bg-amber-accent/20 border-amber-accent/60 text-amber-accent'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}
              aria-label={appState === 'playing' ? 'Pause playback' : 'Play tab'}
            >
              {appState === 'playing' ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                  <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Tablature Area */}
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <TabRenderer
            ref={tabRendererRef}
            onApiReady={handleApiReady}
            onScoreLoaded={() => {
              setScoreLoaded(true)
              setTimeout(extractScoreInfo, 100)
            }}
            onFileOpened={handleFileOpened}
            onSongClosed={handleSongClosed}
          />

          {/* Recent Songs overlay — shown when no score is loaded */}
          {!scoreLoaded && recentSongs.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
              <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest mb-2">Recent</p>
              <div className="flex flex-col gap-1">
                {recentSongs.map((song) => (
                  <button
                    key={song.gpFilePath}
                    onClick={() => handleLoadRecent(song)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all text-left group"
                  >
                    <span className="text-zinc-400 text-xs font-medium truncate group-hover:text-zinc-300 transition-colors">
                      {song.title || song.songFilename}
                      {song.artist && <span className="text-zinc-600 ml-1.5">— {song.artist}</span>}
                    </span>
                    {song.takesCount > 0 && (
                      <span className="text-zinc-600 text-[10px] font-mono shrink-0 ml-3">
                        {song.takesCount} {song.takesCount === 1 ? 'take' : 'takes'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* RIGHT COLUMN — Sidebar                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex flex-col bg-charcoal-light border-l border-zinc-800 overflow-hidden">

        {/* App Title Bar */}
        <div className="shrink-0 px-4 py-2.5 border-b border-zinc-800 text-center">
          <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-zinc-500">GuitarApp</span>
        </div>

        {/* Live Feed — Webcam */}
        <div className="shrink-0 px-3 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500">Live Feed</span>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">
              Active: <span className="text-zinc-400">User</span>
            </span>
          </div>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-xs gap-1">
                <span>Camera unavailable</span>
                <code className="text-red-400 text-[10px]">{cameraError}</code>
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
            {/* Recording indicator */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  appState === 'recording' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'
                }`}
              />
              <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">
                {appState === 'recording' ? 'REC' : 'LIVE'}
              </span>
            </div>
          </div>
        </div>

        {/* Control Deck */}
        <div className="shrink-0 px-3 pt-4">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500 block mb-3">Control Deck</span>

          {/* Pill Dropdowns */}
          <div className="flex flex-col gap-2 mb-4">
            <select className="pill-select bg-zinc-800/80 text-zinc-300 text-xs border border-zinc-700 rounded-full px-4 py-2 focus:outline-none focus:border-amber-accent/50 cursor-pointer">
              <option>Sound Preset: CLEAN LEAD</option>
              <option>Sound Preset: OVERDRIVE</option>
              <option>Sound Preset: DISTORTION</option>
              <option>Sound Preset: ACOUSTIC</option>
            </select>
            <select className="pill-select bg-zinc-800/80 text-zinc-300 text-xs border border-zinc-700 rounded-full px-4 py-2 focus:outline-none focus:border-amber-accent/50 cursor-pointer">
              <option>Tuner: E STANDARD</option>
              <option>Tuner: DROP D</option>
              <option>Tuner: D STANDARD</option>
              <option>Tuner: OPEN G</option>
            </select>
            <select className="pill-select bg-zinc-800/80 text-zinc-300 text-xs border border-zinc-700 rounded-full px-4 py-2 focus:outline-none focus:border-amber-accent/50 cursor-pointer">
              <option>Tempo: {bpm || 120} BPM</option>
            </select>
          </div>

          {/* Record + Playback Controls */}
          <div className="flex items-center justify-center gap-3">
            {/* Metronome Toggle */}
            <button
              onClick={toggleMetronome}
              disabled={!scoreLoaded}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                metronomeOn
                  ? 'bg-amber-accent/20 border-amber-accent/50 text-amber-accent'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
              }`}
              aria-label="Toggle metronome"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L8 22h8L12 2z" />
                <line x1="12" y1="8" x2="18" y2="4" />
              </svg>
            </button>

            {/* Record Button */}
            {appState === 'recording' ? (
              <button
                onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-charcoal border-2 border-red-500/80 flex items-center justify-center transition-all hover:border-red-400 active:scale-95"
                aria-label="Stop recording"
              >
                <div className="w-5 h-5 rounded-sm bg-red-500" />
              </button>
            ) : (
              <button
                onClick={startCountdown}
                disabled={appState === 'countdown' || appState === 'playing' || !!cameraError || !scoreLoaded}
                className="w-14 h-14 rounded-full bg-amber-accent/10 border-2 border-amber-accent flex items-center justify-center transition-all hover:bg-amber-accent/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed animate-glowAmber"
                aria-label="Start recording"
              >
                <span className="text-amber-accent text-[10px] font-bold tracking-wider">REC</span>
              </button>
            )}

            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              disabled={!scoreLoaded || appState === 'countdown' || appState === 'recording'}
              className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                appState === 'playing'
                  ? 'bg-amber-accent/20 border-amber-accent/50 text-amber-accent'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600'
              }`}
              aria-label={appState === 'playing' ? 'Stop playback' : 'Play tab'}
            >
              {appState === 'playing' ? (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                  <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Takes Vault */}
        <div className="flex-1 flex flex-col min-h-0 px-3 pt-4 pb-3">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-zinc-500 mb-2 shrink-0">
            Takes Vault ({takes.length})
          </span>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5">
            {takes.length === 0 && (
              <p className="text-zinc-600 text-xs text-center py-4">No takes yet</p>
            )}
            {takes.map((take, index) => (
              <div
                key={take.id}
                onClick={() => setTheaterTake(take)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all group cursor-pointer"
              >
                {/* Video thumbnail */}
                <div className="shrink-0">
                  <TakeThumbnail
                    filePath={take.filePath}
                    onFileMissing={() => {
                      setTakes(prev => prev.filter(t => t.id !== take.id))
                    }}
                  />
                </div>
                {/* Take info */}
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-300 text-xs font-medium truncate">{take.name || `Take #${index + 1}`}</p>
                  <p className="text-zinc-500 text-[10px] font-mono">{take.date}</p>
                  <p className="text-zinc-600 text-[10px] font-mono">{take.speed}% Speed</p>
                </div>
                {/* Star rating */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newRating = take.rating ? 0 : 1
                    window.electronAPI?.updateTakeRating(songFilename, take.id, newRating)
                    setTakes(prev => prev.map(t => t.id === take.id ? { ...t, rating: newRating } : t))
                  }}
                  className="shrink-0 transition-all hover:scale-110"
                  aria-label="Toggle star"
                >
                  <svg viewBox="0 0 24 24" className={`w-5 h-5 ${take.rating ? 'text-amber-accent fill-amber-accent' : 'text-zinc-700 fill-none'}`} stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Theater Mode Overlay                                    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {theaterTake && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeTheater}
        >
          {/* Close button */}
          <button
            onClick={closeTheater}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-zinc-800/80 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-500 transition-all z-10"
            aria-label="Close theater mode"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Take info header */}
          <div className="absolute top-5 left-5 z-10">
            <p className="text-zinc-300 text-sm font-medium">
              {theaterTake.name || `Take #${takes.findIndex(t => t.id === theaterTake.id) + 1}`}
            </p>
            <p className="text-zinc-500 text-xs font-mono">{theaterTake.date} &middot; {theaterTake.speed}% Speed</p>
          </div>

          {/* Video player — 70% width, 16:9 */}
          <div
            className="w-[70vw] max-h-[80vh] aspect-video rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={theaterVideoRef}
              src={takeVideoUrl(theaterTake.filePath)}
              controls
              autoPlay
              className="w-full h-full bg-black"
              onError={() => {
                console.warn('Theater video failed to load — file may be missing:', theaterTake.filePath)
                setTakes(prev => prev.filter(t => t.id !== theaterTake.id))
                setTheaterTake(null)
              }}
            />
          </div>
        </div>
      )}

      {/* Take Saved Toast */}
      {toastTake && (
        <TakeToast
          key={toastTake.id}
          defaultName={`Take #${takes.length}`}
          onRename={(newName) => {
            window.electronAPI?.renameTake(songFilename, toastTake.id, newName)
            setTakes(prev => prev.map(t => t.id === toastTake.id ? { ...t, name: newName } : t))
          }}
          onRate={(score) => {
            window.electronAPI?.updateTakeRating(songFilename, toastTake.id, score)
            setTakes(prev => prev.map(t => t.id === toastTake.id ? { ...t, rating: score } : t))
          }}
          onDelete={() => {
            window.electronAPI?.deleteTake(songFilename, toastTake.id)
            setTakes(prev => prev.filter(t => t.id !== toastTake.id))
            setToastTake(null)
          }}
          onFavorite={(isFav) => {
            console.log('Favorite take:', toastTake.id, isFav)
          }}
          onDismiss={() => setToastTake(null)}
        />
      )}

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
