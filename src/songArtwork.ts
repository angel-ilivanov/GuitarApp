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

export function getSongArtworkBackground(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }

  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}
