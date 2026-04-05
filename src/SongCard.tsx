const GRADIENTS = [
  'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)',
  'linear-gradient(135deg, #2563eb 0%, #1e3a5f 100%)',
  'linear-gradient(135deg, #0d9488 0%, #134e4a 100%)',
  'linear-gradient(135deg, #16a34a 0%, #14532d 100%)',
  'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #3b0764 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #0c4a6e 100%)',
  'linear-gradient(135deg, #e11d48 0%, #4c0519 100%)',
]

function getGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

interface SongCardProps {
  song: SongObject
  onClick: () => void
}

export default function SongCard({ song, onClick }: SongCardProps) {
  const takesCount = song.stats?.totalTakes ?? 0
  const tuning = song.tuning || 'E Std'

  return (
    <button
      onClick={onClick}
      className="flex items-stretch gap-0 rounded-xl bg-[#252525] border border-zinc-800 hover:border-amber-accent/40 transition-all cursor-pointer group text-left overflow-hidden w-full"
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
            style={{ background: getGradient(song.id) }}
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
