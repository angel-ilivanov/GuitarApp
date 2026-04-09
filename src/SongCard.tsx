import { getSongArtworkBackground } from './songArtwork'

interface SongCardProps {
  song: Song
  onClick: () => void
  active?: boolean
}

export default function SongCard({ song, onClick, active = false }: SongCardProps) {
  const takesCount = song.takes?.length ?? 0
  const tuning = song.tuning || 'E Std'

  return (
    <button
      onClick={onClick}
      className={`group flex w-full cursor-pointer items-stretch gap-0 overflow-hidden rounded-xl border bg-[#252525] text-left transition-all duration-150 ease-in-out ${
        active
          ? 'border-amber-accent/60 shadow-[0_0_0_1px_rgba(255,183,3,0.16)]'
          : 'border-zinc-800 hover:border-amber-accent/40'
      }`}
    >
      {/* Album Art */}
      <div className="w-[88px] h-[88px] shrink-0">
        {song.albumArt ? (
          <img
            src={song.albumArt}
            alt={`${song.title} cover`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: getSongArtworkBackground(song.id) }}
          />
        )}
      </div>

      {/* Song Info */}
      <div className="flex flex-col justify-center px-3 py-2 min-w-0 flex-1">
        <p className="text-zinc-100 text-sm font-semibold truncate group-hover:text-white transition-colors">
          {song.title || 'Untitled'}
        </p>
        <p className="text-zinc-500 text-xs truncate mt-0.5">
          {song.artist || 'Unknown Artist'}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-amber-accent text-[11px] font-medium">
            {takesCount} {takesCount === 1 ? 'take' : 'takes'}
          </span>
          <span className="text-zinc-500 text-[11px]">
            {tuning}
          </span>
        </div>
      </div>
    </button>
  )
}
