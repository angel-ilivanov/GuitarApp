import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Plyr from 'plyr'
import * as alphaTab from '@coderline/alphatab'
import TabRenderer from './TabRenderer'
import type { TabRendererHandle } from './TabRenderer'
import TakeToast from './TakeToast'
import LeftWorkspace from './LeftWorkspace'
import SidebarPanel from './SidebarPanel'
import TheaterOverlay from './TheaterOverlay'
import { fetchAlbumArt } from './iTunesApi'
import type { LeftView, LibraryFilter, SidebarMode } from './librarySelectors'
import { getTakeDisplayName } from './takeUtils'

type AppState = 'idle' | 'countdown' | 'recording' | 'playing'
type SongMetadata = { title: string; artist: string; bpm: number }

interface TakeSelection {
  songId: string
  takeId: string
}

function extractSongMetadata(data: Uint8Array): SongMetadata | null {
  try {
    const settings = new alphaTab.Settings()
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data, settings)

    return {
      title: score.title || '',
      artist: score.artist || '',
      bpm: score.tempo ?? 0,
    }
  } catch (err) {
    console.error('Failed to extract song metadata:', err)
    return null
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const alphaTabApiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const tabRendererRef = useRef<TabRendererHandle>(null)
  const reviewVideoRef = useRef<HTMLVideoElement>(null)
  const theaterVideoRef = useRef<HTMLVideoElement>(null)
  const plyrRef = useRef<Plyr | null>(null)

  const [songs, setSongs] = useState<Song[]>([])
  const [leftView, setLeftView] = useState<LeftView>('play')
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('recording')
  const [activeLibraryFilter, setActiveLibraryFilter] = useState<LibraryFilter>('none')
  const [appState, setAppState] = useState<AppState>('idle')
  const [countdown, setCountdown] = useState(0)
  const [metronomeOn, setMetronomeOn] = useState(false)
  const [countInEnabled, setCountInEnabled] = useState(true)
  const [cameraError, setCameraError] = useState<string | false>(false)
  const [scoreLoaded, setScoreLoaded] = useState(false)
  const [activeSongId, setActiveSongId] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [bpm, setBpm] = useState(0)
  const [timeSig, setTimeSig] = useState('')
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [masterVolume, setMasterVolume] = useState(1)
  const [isPlaybackActive, setIsPlaybackActive] = useState(false)
  const [reviewSelection, setReviewSelection] = useState<TakeSelection | null>(null)
  const [theaterSelection, setTheaterSelection] = useState<TakeSelection | null>(null)
  const [toastTake, setToastTake] = useState<Take | null>(null)
  const [reviewIsPlaying, setReviewIsPlaying] = useState(false)
  const [reviewCurrentTime, setReviewCurrentTime] = useState(0)
  const [reviewDuration, setReviewDuration] = useState(0)

  const activeSong = useMemo(() => songs.find((song) => song.id === activeSongId) ?? null, [songs, activeSongId])
  const reviewSong = useMemo(() => songs.find((song) => song.id === reviewSelection?.songId) ?? null, [songs, reviewSelection])
  const reviewTake = useMemo(() => reviewSong?.takes.find((take) => take.id === reviewSelection?.takeId) ?? null, [reviewSong, reviewSelection])
  const theaterSong = useMemo(() => songs.find((song) => song.id === theaterSelection?.songId) ?? null, [songs, theaterSelection])
  const theaterTake = useMemo(() => theaterSong?.takes.find((take) => take.id === theaterSelection?.takeId) ?? null, [theaterSong, theaterSelection])
  const reviewTakeFilePath = reviewTake?.filePath ?? null
  const theaterTakeFilePath = theaterTake?.filePath ?? null
  const effectiveSidebarMode: SidebarMode = sidebarMode === 'reviewing' && reviewTake ? 'reviewing' : 'recording'
  const effectiveReviewSelection = reviewTake ? reviewSelection : null
  const reviewMediaKey = effectiveReviewSelection && reviewTakeFilePath
    ? `${effectiveReviewSelection.songId}:${effectiveReviewSelection.takeId}:${reviewTakeFilePath}`
    : null
  const theaterMediaKey = theaterSelection && theaterTakeFilePath
    ? `${theaterSelection.songId}:${theaterSelection.takeId}:${theaterTakeFilePath}`
    : null
  const sidebarSong = effectiveSidebarMode === 'reviewing' ? reviewSong : activeSong
  const sidebarTakes = useMemo(
    () => [...(sidebarSong?.takes ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [sidebarSong],
  )

  const refreshSongs = useCallback(async (): Promise<Song[]> => {
    const nextSongs = await window.electronAPI?.getAllSongs() ?? []
    setSongs(nextSongs)
    return nextSongs
  }, [])

  const updateSongTakes = useCallback((songId: string, updater: (takes: Take[]) => Take[]) => {
    setSongs((current) => current.map((song) => (
      song.id === songId
        ? { ...song, takes: updater(song.takes ?? []) }
        : song
    )))
  }, [])

  const refreshSongTakes = useCallback(async (songId: string) => {
    if (!songId) return []
    const nextTakes = await window.electronAPI?.getTakesForSong(songId) ?? []
    updateSongTakes(songId, () => nextTakes)
    return nextTakes
  }, [updateSongTakes])

  const resetReviewPlaybackState = useCallback(() => {
    setReviewCurrentTime(0)
    setReviewDuration(0)
    setReviewIsPlaying(false)
  }, [])

  const exitReviewMode = useCallback(() => {
    resetReviewPlaybackState()
    setSidebarMode('recording')
    setReviewSelection(null)
  }, [resetReviewPlaybackState])

  const persistSongMetadata = useCallback(async (songId: string, metadata: SongMetadata) => {
    await window.electronAPI?.updateSong(songId, metadata)
    const nextSongs = await refreshSongs()
    const song = nextSongs.find((entry) => entry.id === songId)
    if (!song?.albumArt && (metadata.title || metadata.artist)) {
      const artUrl = await fetchAlbumArt(metadata.title, metadata.artist)
      if (artUrl) {
        await window.electronAPI?.updateSong(songId, { albumArt: artUrl })
        await refreshSongs()
      }
    }
  }, [refreshSongs])

  const extractScoreInfo = useCallback(() => {
    const score = alphaTabApiRef.current?.score
    if (!score) return
    setBpm(score.tempo)
    const masterBar = score.masterBars?.[0]
    if (masterBar) {
      setTimeSig(`${masterBar.timeSignatureNumerator}/${masterBar.timeSignatureDenominator}`)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshSongs()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [refreshSongs])

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
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('getUserMedia failed:', error)
        setCameraError(`${error.name}: ${error.message}`)
      }
    }

    void initCamera()

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  useEffect(() => {
    if (sidebarMode === 'recording' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [sidebarMode])

  useEffect(() => {
    if (effectiveSidebarMode !== 'reviewing' || !reviewMediaKey || !reviewVideoRef.current) return

    const video = reviewVideoRef.current
    video.srcObject = null
    const handleLoadedMetadata = () => setReviewDuration(video.duration || 0)
    const handleTimeUpdate = () => setReviewCurrentTime(video.currentTime || 0)
    const handlePlay = () => setReviewIsPlaying(true)
    const handlePause = () => setReviewIsPlaying(false)
    const handleEnded = () => setReviewIsPlaying(false)

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.currentTime = 0
    video.load()
    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      void playPromise.catch(() => {})
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [effectiveSidebarMode, reviewMediaKey])

  useEffect(() => {
    if (plyrRef.current) {
      plyrRef.current.destroy()
      plyrRef.current = null
    }
    if (!theaterMediaKey || !theaterVideoRef.current) return

    const player = new Plyr(theaterVideoRef.current, {
      controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'fullscreen'],
      keyboard: { focused: true, global: false },
      tooltips: { controls: true, seek: true },
      resetOnEnd: true,
    })
    player.on('ready', () => {
      const playPromise = player.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        void playPromise.catch(() => {})
      }
    })
    plyrRef.current = player

    return () => {
      if (plyrRef.current) {
        plyrRef.current.destroy()
        plyrRef.current = null
      }
    }
  }, [theaterMediaKey])

  const handleApiReady = useCallback((api: alphaTab.AlphaTabApi) => {
    alphaTabApiRef.current = api
    api.playbackSpeed = playbackSpeed
    api.masterVolume = masterVolume
    setIsPlaybackActive(api.playerState === alphaTab.synth.PlayerState.Playing)
    api.playerStateChanged.on((args) => {
      const playing = args.state === alphaTab.synth.PlayerState.Playing
      setIsPlaybackActive(playing)
      if (!playing) {
        setAppState((current) => (current === 'playing' ? 'idle' : current))
      }
    })
  }, [masterVolume, playbackSpeed])

  const enterPlayWorkspace = useCallback((songId: string, title: string, artist: string) => {
    setActiveSongId(songId)
    setSongTitle(title)
    setSongArtist(artist)
    setLeftView('play')
    setSidebarMode('recording')
    setReviewSelection(null)
  }, [])

  const handleFileOpened = useCallback((songId: string, title: string, artist: string) => {
    enterPlayWorkspace(songId, title, artist)
    void refreshSongTakes(songId)
    setTimeout(() => {
      extractScoreInfo()
      const scoreBpm = alphaTabApiRef.current?.score?.tempo ?? 0
      void persistSongMetadata(songId, { title, artist, bpm: scoreBpm })
    }, 100)
  }, [enterPlayWorkspace, extractScoreInfo, persistSongMetadata, refreshSongTakes])

  const handleLoadFromLibrary = useCallback(async (song: Song) => {
    const result = await window.electronAPI?.loadSongFile(song.id)
    if (!result) return
    if (result.error === 'file_not_found') return alert('File no longer exists at the saved location.')
    if (result.error || !result.buffer) return alert('Failed to read file.')

    const fileName = result.fileName || 'untitled.gp'
    const meta = tabRendererRef.current?.loadFromBuffer(new Uint8Array(result.buffer), fileName)
    const title = meta?.title ?? song.title
    const artist = meta?.artist ?? song.artist
    enterPlayWorkspace(song.id, title, artist)
    await refreshSongTakes(song.id)

    setTimeout(() => {
      extractScoreInfo()
      const scoreBpm = alphaTabApiRef.current?.score?.tempo ?? 0
      void persistSongMetadata(song.id, { title, artist, bpm: scoreBpm })
    }, 100)
  }, [enterPlayWorkspace, extractScoreInfo, persistSongMetadata, refreshSongTakes])

  const handlePlayWorkspaceOpenFile = useCallback(async () => {
    const result = await window.electronAPI?.openFileDialog()
    if (!result || result.cancelled || !result.songId || !result.buffer) return

    const buffer = new Uint8Array(result.buffer)
    const extracted = extractSongMetadata(buffer)
    const fileName = result.filePath?.split(/[/\\]/).pop() || 'untitled.gp'
    const songId = result.songId
    const meta = tabRendererRef.current?.loadFromBuffer(buffer, fileName)
    const title = meta?.title || extracted?.title || ''
    const artist = meta?.artist || extracted?.artist || ''
    enterPlayWorkspace(songId, title, artist)
    await refreshSongTakes(songId)

    setTimeout(() => {
      extractScoreInfo()
      const scoreBpm = alphaTabApiRef.current?.score?.tempo ?? extracted?.bpm ?? 0
      void persistSongMetadata(songId, { title, artist, bpm: scoreBpm })
    }, 100)
  }, [enterPlayWorkspace, extractScoreInfo, persistSongMetadata, refreshSongTakes])

  const handleTestTab = useCallback(async () => {
    try {
      const response = await fetch('/test-tab.gp')
      const buffer = await response.arrayBuffer()
      const meta = tabRendererRef.current?.loadFromBuffer(new Uint8Array(buffer), 'test-tab.gp')
      setActiveSongId('')
      setSongTitle(meta?.title || '')
      setSongArtist(meta?.artist || '')
      setLeftView('play')
      setSidebarMode('recording')
      setReviewSelection(null)
      setTimeout(extractScoreInfo, 100)
    } catch (err) {
      console.error('Failed to load test tab:', err)
    }
  }, [extractScoreInfo])

  const handleClearLibrary = useCallback(async () => {
    await window.electronAPI?.clearLibrary()
    setSongs([])
    setReviewSelection(null)
    setTheaterSelection(null)
    setSidebarMode('recording')
  }, [])

  const playTick = useCallback((isFirstBeat: boolean) => {
    const context = new AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.frequency.value = isFirstBeat ? 1000 : 800
    gain.gain.setValueAtTime(0.5, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08)
    oscillator.start(context.currentTime)
    oscillator.stop(context.currentTime + 0.08)
    oscillator.onended = () => context.close()
  }, [])

  const beginRecording = useCallback(() => {
    if (!activeSongId || !streamRef.current) return
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9,opus' })
    chunksRef.current = []
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const arrayBuffer = await blob.arrayBuffer()
        const result = await window.electronAPI?.saveVideoTake(arrayBuffer, activeSongId, Math.round(playbackSpeed * 100))
        if (result?.success && result.take) {
          await refreshSongTakes(activeSongId)
          setToastTake(result.take)
        }
      } catch (err) {
        console.error('Failed to save take:', err)
      }
    }
    recorderRef.current = recorder
    recorder.start()
    alphaTabApiRef.current?.play()
    setIsPlaybackActive(true)
    setAppState('recording')
  }, [activeSongId, playbackSpeed, refreshSongTakes])

  const startCountdown = useCallback(() => {
    if (!countInEnabled) return beginRecording()
    const score = alphaTabApiRef.current?.score
    const scoreBpm = score?.tempo ?? 120
    const beats = score?.masterBars?.[0]?.timeSignatureNumerator ?? 4
    const millisecondsPerBeat = 60000 / scoreBpm
    alphaTabApiRef.current?.pause()
    setIsPlaybackActive(false)
    setAppState('countdown')
    setCountdown(beats)
    playTick(true)

    let remaining = beats
    const interval = setInterval(() => {
      remaining -= 1
      if (remaining === 0) {
        clearInterval(interval)
        setCountdown(0)
        beginRecording()
      } else {
        playTick(false)
        setCountdown(remaining)
      }
    }, millisecondsPerBeat)
  }, [beginRecording, countInEnabled, playTick])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    alphaTabApiRef.current?.stop()
    setIsPlaybackActive(false)
    setAppState('idle')
  }, [])

  const togglePlay = useCallback(() => {
    const api = alphaTabApiRef.current
    if (!api) return
    const playing = api.playerState === alphaTab.synth.PlayerState.Playing
    if (playing) {
      api.pause()
      setIsPlaybackActive(false)
      if (appState === 'playing') setAppState('idle')
      return
    }
    api.play()
    setIsPlaybackActive(true)
    if (appState !== 'recording') setAppState('playing')
  }, [appState])

  const toggleMetronome = useCallback(() => {
    const nextValue = !metronomeOn
    setMetronomeOn(nextValue)
    if (alphaTabApiRef.current) {
      alphaTabApiRef.current.metronomeVolume = nextValue ? 1 : 0
    }
  }, [metronomeOn])

  useEffect(() => {
    if (alphaTabApiRef.current) alphaTabApiRef.current.playbackSpeed = playbackSpeed
  }, [playbackSpeed])

  useEffect(() => {
    if (alphaTabApiRef.current) alphaTabApiRef.current.masterVolume = masterVolume
  }, [masterVolume])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (event.key === 'Escape') {
        if (theaterSelection) {
          setTheaterSelection(null)
          return
        }
        if (effectiveSidebarMode === 'reviewing') {
          exitReviewMode()
        }
      }

      if ((event.key === 'r' || event.key === 'R' || event.key === 'р' || event.key === 'Р') && !event.ctrlKey && !event.metaKey) {
        if (appState === 'recording') stopRecording()
        else if ((appState === 'idle' || appState === 'playing') && scoreLoaded && !cameraError && !!activeSongId) startCountdown()
      }
      if ((event.key === ' ' || event.key === 'k' || event.key === 'K' || event.key === 'к' || event.key === 'К') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        if (scoreLoaded && appState !== 'countdown') togglePlay()
      }
      if ((event.key === 'm' || event.key === 'M' || event.key === 'м' || event.key === 'М') && !event.ctrlKey && !event.metaKey) {
        if (scoreLoaded) toggleMetronome()
      }
      if ((event.key === 'c' || event.key === 'C' || event.key === 'ц' || event.key === 'Ц') && !event.ctrlKey && !event.metaKey) {
        if (scoreLoaded) setCountInEnabled((current) => !current)
      }
      if (event.key === 'Enter') event.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeSongId, appState, cameraError, effectiveSidebarMode, exitReviewMode, scoreLoaded, startCountdown, stopRecording, theaterSelection, toggleMetronome, togglePlay])

  const handleSetLeftView = useCallback((view: LeftView) => {
    setLeftView(view)
    if (view === 'play') {
      exitReviewMode()
    }
  }, [exitReviewMode])

  const handleSongClosed = useCallback(() => {
    recorderRef.current?.stop()
    alphaTabApiRef.current?.stop()
    setIsPlaybackActive(false)
    setAppState('idle')
    setScoreLoaded(false)
    setActiveSongId('')
    setSongTitle('')
    setSongArtist('')
    setBpm(0)
    setTimeSig('')
  }, [])

  const handleRateTake = useCallback(async (songId: string, takeId: string, rating: number) => {
    await window.electronAPI?.updateTakeRating(songId, takeId, rating)
    updateSongTakes(songId, (takes) => takes.map((take) => take.id === takeId ? { ...take, rating } : take))
  }, [updateSongTakes])

  const handleRenameTake = useCallback(async (songId: string, takeId: string, name: string) => {
    await window.electronAPI?.renameTake(songId, takeId, name)
    updateSongTakes(songId, (takes) => takes.map((take) => take.id === takeId ? { ...take, name } : take))
  }, [updateSongTakes])

  const handleDeleteTake = useCallback(async (songId: string, takeId: string) => {
    await window.electronAPI?.deleteTake(songId, takeId)
    updateSongTakes(songId, (takes) => takes.filter((take) => take.id !== takeId))
    setToastTake((current) => (current?.id === takeId ? null : current))
    setReviewSelection((current) => (current?.songId === songId && current.takeId === takeId ? null : current))
    setTheaterSelection((current) => (current?.songId === songId && current.takeId === takeId ? null : current))
    if (reviewSelection?.songId === songId && reviewSelection.takeId === takeId) {
      setSidebarMode('recording')
    }
  }, [reviewSelection, updateSongTakes])

  return (
    <div className="relative grid h-dvh w-screen select-none overflow-hidden bg-charcoal grid-cols-[75%_25%]">
      <LeftWorkspace
        leftView={leftView}
        scoreLoaded={scoreLoaded}
        songTitle={songTitle}
        songArtist={songArtist}
        bpm={bpm}
        timeSig={timeSig}
        isPlaybackActive={isPlaybackActive}
        appState={appState}
        activeSongId={activeSongId}
        songs={songs}
        activeLibraryFilter={activeLibraryFilter}
        reviewSelection={effectiveReviewSelection}
        onSetLeftView={handleSetLeftView}
        onTogglePlay={togglePlay}
        onLoadSong={handleLoadFromLibrary}
        onOpenFile={handlePlayWorkspaceOpenFile}
        onClearAll={handleClearLibrary}
        onTestTab={handleTestTab}
        onFilterChange={setActiveLibraryFilter}
        onRateTake={handleRateTake}
        onDeleteTake={(songId, takeId) => { void handleDeleteTake(songId, takeId) }}
        onPlayTake={(songId, takeId) => {
          resetReviewPlaybackState()
          setReviewSelection({ songId, takeId })
          setSidebarMode('reviewing')
        }}
        onExpandTake={(songId, takeId) => setTheaterSelection({ songId, takeId })}
      >
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
      </LeftWorkspace>

      <SidebarPanel
        sidebarMode={effectiveSidebarMode}
        appState={appState}
        cameraError={cameraError}
        scoreLoaded={scoreLoaded}
        activeSongId={activeSongId}
        activeSong={activeSong}
        reviewSong={reviewSong}
        reviewTake={reviewTake}
        reviewSelection={effectiveReviewSelection}
        sidebarTakes={sidebarTakes}
        reviewIsPlaying={reviewIsPlaying}
        reviewCurrentTime={reviewCurrentTime}
        reviewDuration={reviewDuration}
        playbackSpeed={playbackSpeed}
        masterVolume={masterVolume}
        metronomeOn={metronomeOn}
        countInEnabled={countInEnabled}
        isPlaybackActive={isPlaybackActive}
        videoRef={videoRef}
        reviewVideoRef={reviewVideoRef}
        onOpenReview={(songId, takeId) => {
          resetReviewPlaybackState()
          setReviewSelection({ songId, takeId })
          setSidebarMode('reviewing')
        }}
        onRateTake={(songId, takeId, rating) => { void handleRateTake(songId, takeId, rating) }}
        onDeleteTake={(songId, takeId) => { void handleDeleteTake(songId, takeId) }}
        onRefreshSongTakes={(songId) => { void refreshSongTakes(songId) }}
        onStartCountdown={startCountdown}
        onStopRecording={stopRecording}
        onTogglePlay={togglePlay}
        onToggleMetronome={toggleMetronome}
        onToggleCountIn={() => setCountInEnabled((current) => !current)}
        onSetPlaybackSpeed={setPlaybackSpeed}
        onSetMasterVolume={setMasterVolume}
        onOpenTheater={(songId, takeId) => setTheaterSelection({ songId, takeId })}
        onExitReview={exitReviewMode}
        onShowTakeInFolder={(filePath) => { void window.electronAPI?.showInFolder(filePath) }}
      />

      <TheaterOverlay
        take={theaterTake}
        songId={theaterSelection?.songId ?? null}
        videoRef={theaterVideoRef}
        onClose={() => setTheaterSelection(null)}
        onRate={(songId, takeId, rating) => { void handleRateTake(songId, takeId, rating) }}
        onDelete={(songId, takeId) => { void handleDeleteTake(songId, takeId) }}
        onShowInFolder={(filePath) => { void window.electronAPI?.showInFolder(filePath) }}
        onTakeMissing={(songId) => { void refreshSongTakes(songId) }}
      />

      {toastTake && activeSongId && (
        <TakeToast
          key={toastTake.id}
          defaultName={getTakeDisplayName(toastTake)}
          onRename={(newName) => { void handleRenameTake(activeSongId, toastTake.id, newName) }}
          onRate={(score) => { void handleRateTake(activeSongId, toastTake.id, score) }}
          onDelete={() => {
            void handleDeleteTake(activeSongId, toastTake.id)
            setToastTake(null)
          }}
          onFavorite={(isFavorite) => {
            console.log('Favorite take:', toastTake.id, isFavorite)
          }}
          onDismiss={() => setToastTake(null)}
        />
      )}

      {appState === 'countdown' && countdown > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <span key={countdown} className="animate-[countPulse_1s_ease-out] text-[160px] font-bold tabular-nums text-white">
            {countdown}
          </span>
        </div>
      )}
    </div>
  )
}

export default App
