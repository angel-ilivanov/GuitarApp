import { useRef, useState, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'

interface TrackInfo {
  index: number
  name: string
}

interface TabRendererProps {
  onApiReady?: (api: alphaTab.AlphaTabApi) => void
}

function TabRenderer({ onApiReady }: TabRendererProps) {
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
    settings.display.scale = 1.0
    settings.core.logLevel = alphaTab.LogLevel.Warning
    settings.core.fontDirectory = '/font/'
    settings.core.enableLazyLoading = false
    settings.core.useWorkers = false
    settings.core.engine = 'svg'

    // Dark mode colors
    settings.display.resources.staffLineColor = new alphaTab.model.Color(71, 85, 105, 255)       // slate-600
    settings.display.resources.barSeparatorColor = new alphaTab.model.Color(100, 116, 139, 255)   // slate-500
    settings.display.resources.mainGlyphColor = new alphaTab.model.Color(226, 232, 240, 255)      // slate-200
    settings.display.resources.secondaryGlyphColor = new alphaTab.model.Color(148, 163, 184, 100) // slate-400
    settings.display.resources.barNumberColor = new alphaTab.model.Color(167, 139, 250, 255)      // violet-400
    settings.display.resources.scoreInfoColor = new alphaTab.model.Color(203, 213, 225, 255)      // slate-300

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

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !containerRef.current) return

    setLoading(true)
    setFileName(file.name)

    // Lazily initialize the API on first file upload
    initApi()

    const reader = new FileReader()
    reader.onload = () => {
      const data = new Uint8Array(reader.result as ArrayBuffer)
      try {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
          data,
          apiRef.current!.settings
        )
        scoreRef.current = score

        // Extract track info
        const trackList = score.tracks.map((t) => ({
          index: t.index,
          name: t.name || `Track ${t.index + 1}`,
        }))
        setTracks(trackList)
        setSelectedTrack(0)

        apiRef.current!.renderScore(score, [0])
        setLoaded(true)
      } catch {
        setLoading(false)
        alert('Failed to load file. Please ensure it is a valid Guitar Pro file.')
      }
    }
    reader.readAsArrayBuffer(file)

    // Reset input so the same file can be re-uploaded
    e.target.value = ''
  }, [initApi])

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
          <label className="cursor-pointer group">
            <input
              type="file"
              accept=".gp,.gp3,.gp4,.gp5,.gpx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center group-hover:border-violet-500/60 group-hover:bg-zinc-700/80 transition-all">
                <svg viewBox="0 0 24 24" className="w-6 h-6 text-zinc-400 group-hover:text-violet-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-sm font-medium">Upload Guitar Pro File</p>
                <p className="text-zinc-600 text-xs mt-1">.gp, .gp3, .gp4, .gp5, .gpx</p>
              </div>
            </div>
          </label>
        ) : (
          <div className="flex items-center gap-3 px-4 w-full">
            {/* Track selector */}
            {tracks.length > 1 && (
              <select
                value={selectedTrack}
                onChange={(e) => handleTrackChange(Number(e.target.value))}
                className="bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-500/60 cursor-pointer flex-1 min-w-0 truncate appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
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
            <label className="cursor-pointer text-xs text-violet-400 hover:text-violet-300 transition-colors shrink-0">
              Change
              <input
                type="file"
                accept=".gp,.gp3,.gp4,.gp5,.gpx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4 shrink-0">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs ml-2">Rendering...</span>
        </div>
      )}

      {/* Scroll wrapper — AlphaTab scrolls this */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0"
      >
        {/* AlphaTab render container — notation renders here */}
        <div
          ref={containerRef}
          className="relative p-4"
        />
      </div>
    </div>
  )
}

export default TabRenderer
