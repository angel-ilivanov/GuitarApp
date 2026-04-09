import { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as alphaTab from '@coderline/alphatab'

interface TrackInfo {
  index: number
  name: string
}

// MIDI programs 24-31 are guitar instruments
const GUITAR_MIDI_PROGRAMS = new Set([24, 25, 26, 27, 28, 29, 30, 31])

// Patterns that strongly indicate a guitar track (most specific first)
const GUITAR_STRONG_PATTERNS = /\bguitar\b|\bgtr\b|\bguit\b/i

// Patterns that indicate guitar when combined with context
const GUITAR_CONTEXTUAL_PATTERNS = /\blead gtr\b|\blead guitar\b|\brhythm\b|\bacoustic\b|\belectric\b|\bdist(ortion|\.)\b|\boverdriv/i

// Common guitarist names found in Guitar Pro files
const KNOWN_GUITARISTS = /\bslash\b|\bfrusciante\b|\bhendrix\b|\bclapton\b|\bgilmour\b|\bpage\b|\bmorello\b|\bhammet/i

// Tracks to explicitly exclude even if they partially match
const NOT_GUITAR = /\bvocal\b|\bvox\b|\bbass\b|\bdrum\b|\bkey\b|\bpiano\b|\borgan\b|\bsynth\b|\bstring\b|\bsax\b|\btrump/i

function findGuitarTrack(tracks: alphaTab.model.Track[]): number {
  // 1. Strong name match (contains "guitar", "gtr", "guit")
  const byStrongName = tracks.find((t) =>
    GUITAR_STRONG_PATTERNS.test(t.name) && !NOT_GUITAR.test(t.name)
  )
  if (byStrongName) return byStrongName.index

  // 2. Contextual name match (lead guitar, rhythm, acoustic, distortion, etc.)
  const byContext = tracks.find((t) =>
    GUITAR_CONTEXTUAL_PATTERNS.test(t.name) && !NOT_GUITAR.test(t.name)
  )
  if (byContext) return byContext.index

  // 3. Known guitarist names
  const byGuitarist = tracks.find((t) =>
    KNOWN_GUITARISTS.test(t.name) && !NOT_GUITAR.test(t.name)
  )
  if (byGuitarist) return byGuitarist.index

  // 4. MIDI program match (guitar patches 24-31)
  const byProgram = tracks.find((t) =>
    GUITAR_MIDI_PROGRAMS.has(t.playbackInfo.program)
  )
  if (byProgram) return byProgram.index

  // 5. Fallback to first track
  return 0
}

export interface TabRendererHandle {
  loadFromBuffer: (data: Uint8Array, fileName: string) => { title: string; artist: string } | null
}

interface TabRendererProps {
  onApiReady?: (api: alphaTab.AlphaTabApi) => void
  onScoreLoaded?: () => void
  onFileOpened?: (songId: string, title: string, artist: string) => void
  onSongClosed?: () => void
}

const TabRenderer = forwardRef<TabRendererHandle, TabRendererProps>(
  function TabRenderer({ onApiReady, onScoreLoaded, onFileOpened, onSongClosed }, ref) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const scoreRef = useRef<alphaTab.model.Score | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [selectedTrack, setSelectedTrack] = useState(0)

  const initApi = useCallback(() => {
    if (apiRef.current || !containerRef.current) return

    const settings = new alphaTab.Settings()
    settings.display.layoutMode = alphaTab.LayoutMode.Page
    settings.display.staveProfile = alphaTab.StaveProfile.Tab
    settings.display.scale = 1.0
    settings.display.padding = [20, 50, 20, 20]  // top, right, bottom, left
    settings.core.logLevel = alphaTab.LogLevel.Warning
    settings.core.fontDirectory = '/font/'
    settings.core.enableLazyLoading = false
    settings.core.useWorkers = false
    settings.core.engine = 'svg'

    // Dark mode colors — muted lines, bright notation
    settings.display.resources.staffLineColor = new alphaTab.model.Color(58, 61, 70, 255)         // #3A3D46 — fades into background
    settings.display.resources.barSeparatorColor = new alphaTab.model.Color(58, 61, 70, 255)      // #3A3D46 — matches staff lines
    settings.display.resources.mainGlyphColor = new alphaTab.model.Color(255, 255, 255, 255)      // white — crisp notation
    settings.display.resources.secondaryGlyphColor = new alphaTab.model.Color(148, 163, 184, 100) // slate-400
    settings.display.resources.barNumberColor = new alphaTab.model.Color(255, 183, 3, 255)        // amber accent
    settings.display.resources.scoreInfoColor = new alphaTab.model.Color(203, 213, 225, 255)      // slate-300

    // Typography
    // Tab numbers — bold and crisp
    settings.display.resources.tablatureFont = new alphaTab.model.Font('Inter', 13, alphaTab.model.FontStyle.Plain, alphaTab.model.FontWeight.Bold)
    settings.display.resources.graceFont = new alphaTab.model.Font('Inter', 9, alphaTab.model.FontStyle.Italic)
    settings.display.resources.barNumberFont = new alphaTab.model.Font('Inter', 10, alphaTab.model.FontStyle.Plain, alphaTab.model.FontWeight.Bold)

    // Score info — elegant serif for title/subtitle
    settings.display.resources.titleFont = new alphaTab.model.Font('Georgia', 28, alphaTab.model.FontStyle.Italic)
    settings.display.resources.subTitleFont = new alphaTab.model.Font('Georgia', 16, alphaTab.model.FontStyle.Italic)
    settings.display.resources.wordsFont = new alphaTab.model.Font('Georgia', 12, alphaTab.model.FontStyle.Italic)
    settings.display.resources.copyrightFont = new alphaTab.model.Font('Inter', 10, alphaTab.model.FontStyle.Italic)

    // Effects & markers — matching serif style
    settings.display.resources.effectFont = new alphaTab.model.Font('Georgia', 10, alphaTab.model.FontStyle.Italic)
    settings.display.resources.markerFont = new alphaTab.model.Font('Georgia', 12, alphaTab.model.FontStyle.Italic)

    // Hide elements that clip or clutter the tab-only view
    settings.notation.elements.set(alphaTab.NotationElement.EffectLyrics, false)
    settings.notation.elements.set(alphaTab.NotationElement.EffectText, false)
    settings.notation.elements.set(alphaTab.NotationElement.EffectFingering, false)

    // Rhythm stems — simplified geometric bars
    settings.notation.rhythmMode = alphaTab.TabRhythmMode.ShowWithBars
    settings.notation.rhythmHeight = 15

    // Player / synthesizer settings
    settings.player.playerMode = alphaTab.PlayerMode.EnabledAutomatic
    settings.player.soundFont = '/soundfont/sonivox.sf3'
    settings.player.enableCursor = true
    settings.player.enableAnimatedBeatCursor = true
    settings.player.scrollMode = alphaTab.ScrollMode.OffScreen
    settings.player.scrollElement = scrollRef.current!

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings)
    apiRef.current = api

    api.renderFinished.on(() => {
      setLoading(false)
    })

    onApiReady?.(api)
  }, [onApiReady])

  const loadFromBuffer = useCallback((data: Uint8Array, name: string): { title: string; artist: string } | null => {
    setLoading(true)
    setFileName(name)
    initApi()

    try {
      const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        data,
        apiRef.current!.settings
      )
      scoreRef.current = score

      const trackList = score.tracks.map((t) => ({
        index: t.index,
        name: t.name || `Track ${t.index + 1}`,
      }))
      setTracks(trackList)

      const defaultTrack = findGuitarTrack(score.tracks)
      setSelectedTrack(defaultTrack)

      apiRef.current!.renderScore(score, [defaultTrack])
      setLoaded(true)
      onScoreLoaded?.()
      return { title: score.title || '', artist: score.artist || '' }
    } catch {
      setLoading(false)
      alert('Failed to load file. Please ensure it is a valid Guitar Pro file.')
      return null
    }
  }, [initApi, onScoreLoaded])

  useImperativeHandle(ref, () => ({ loadFromBuffer }), [loadFromBuffer])

  const openFile = useCallback(async () => {
    const result = await window.electronAPI!.openFileDialog()
    if (result.cancelled) return
    const fileName = result.filePath ? result.filePath.split(/[/\\]/).pop()! : 'untitled.gp'
    const meta = loadFromBuffer(new Uint8Array(result.buffer!), fileName)
    onFileOpened?.(result.songId!, meta?.title || '', meta?.artist || '')
  }, [loadFromBuffer, onFileOpened])

  const resetToHome = useCallback(() => {
    if (apiRef.current) {
      apiRef.current.destroy()
      apiRef.current = null
    }
    scoreRef.current = null
    setLoaded(false)
    setLoading(false)
    setFileName('')
    setTracks([])
    setSelectedTrack(0)
    onSongClosed?.()
  }, [onSongClosed])

  const handleTrackChange = useCallback((trackIndex: number) => {
    if (!apiRef.current || !scoreRef.current) return
    setSelectedTrack(trackIndex)
    setLoading(true)
    apiRef.current.renderScore(scoreRef.current, [trackIndex])
  }, [])

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header bar - upload + track selector */}
      <div className={`flex items-center justify-center shrink-0 ${loaded ? 'py-2 border-b border-zinc-800' : 'py-8'}`}>
        {!loaded ? (
          <button onClick={openFile} className="cursor-pointer group">
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-amber-accent/60 group-hover:bg-zinc-700/80 transition-all">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-zinc-400 group-hover:text-amber-accent transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-sm font-medium">Open Guitar Pro File</p>
                <p className="text-zinc-600 text-xs mt-1">.gp, .gp3, .gp4, .gp5, .gpx</p>
              </div>
            </div>
          </button>
        ) : (
          <div className="flex items-center gap-3 px-4 w-full">
            {/* Track selector */}
            {tracks.length > 1 && (
              <select
                value={selectedTrack}
                onChange={(e) => handleTrackChange(Number(e.target.value))}
                className="bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-accent/60 cursor-pointer flex-1 min-w-0 truncate appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFB703' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
              >
                {tracks.map((t) => (
                  <option key={t.index} value={t.index}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            {tracks.length <= 1 && (
              <span className="text-zinc-500 text-xs font-mono truncate flex-1 min-w-0">{fileName}</span>
            )}
            <button
              onClick={resetToHome}
              className="text-xs text-amber-accent hover:text-amber-glow transition-colors shrink-0"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4 shrink-0">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-accent rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs ml-2">Rendering...</span>
        </div>
      )}

      {/* Scroll wrapper — AlphaTab scrolls this */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-auto min-h-0"
      >
        {/* AlphaTab render container — notation renders here */}
        <div
          ref={containerRef}
          className="relative px-2 py-4"
        />
      </div>
    </div>
  )
})

export default TabRenderer
