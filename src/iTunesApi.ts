const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

const FALLBACK_KEYWORDS = /(live|greatest\s*hits|best\s*of|anthology|essential|tribute|cover|karaoke)/i

export interface ITunesResult {
  trackName?: string
  artistName?: string
  collectionName?: string
  artworkUrl100?: string
  releaseDate?: string
}

function normalizeArtist(name: string): string {
  return name.toLowerCase().replace(/[\u2018\u2019\u0060\u00B4]/g, "'").trim()
}

export function filterByArtist(results: ITunesResult[], artist: string): ITunesResult[] {
  if (!artist) return results
  const artistNorm = normalizeArtist(artist)
  return results.filter(r => normalizeArtist(r.artistName ?? '') === artistNorm)
}

export function filterByTrack(results: ITunesResult[], title: string): ITunesResult[] {
  if (!title) return results
  const titleLower = title.toLowerCase()
  return results.filter(r => r.trackName?.toLowerCase().includes(titleLower))
}

function sortByReleaseDate(a: ITunesResult, b: ITunesResult): number {
  return (a.releaseDate ?? '').localeCompare(b.releaseDate ?? '')
}

function isCleanAlbum(r: ITunesResult): boolean {
  return !FALLBACK_KEYWORDS.test(r.collectionName ?? '')
}

export function selectBestResult(trackMatches: ITunesResult[], artistMatches: ITunesResult[]): ITunesResult | null {
  // Step 1: Try exact track matches — Bucket A (clean studio albums)
  const trackBucketA = trackMatches.filter(isCleanAlbum)
  if (trackBucketA.length > 0) {
    trackBucketA.sort(sortByReleaseDate)
    return trackBucketA[0]
  }

  // Step 2: No clean track match — use any clean studio album by the same artist
  // (the track exists on this album even if iTunes doesn't index it separately)
  const artistBucketA = artistMatches.filter(isCleanAlbum)
  if (artistBucketA.length > 0) {
    artistBucketA.sort(sortByReleaseDate)
    return artistBucketA[0]
  }

  // Step 3: Fall back to track matches Bucket B (live/compilations)
  if (trackMatches.length > 0) {
    const trackBucketB = [...trackMatches].sort(sortByReleaseDate)
    return trackBucketB[0]
  }

  // Step 4: Fall back to any artist result
  if (artistMatches.length > 0) {
    const sorted = [...artistMatches].sort(sortByReleaseDate)
    return sorted[0]
  }

  return null
}

export async function fetchAlbumArt(title: string, artist: string): Promise<string | null> {
  if (!title && !artist) return null

  const query = [artist, title].filter(Boolean).join(' ')
  const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=30`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.results || data.results.length === 0) return null

    const artistMatches = filterByArtist(data.results, artist)
    const trackMatches = filterByTrack(artistMatches, title)

    const best = selectBestResult(trackMatches, artistMatches)

    if (!best?.artworkUrl100) {
      // Absolute fallback — first raw result
      const artworkUrl = data.results[0].artworkUrl100
      if (!artworkUrl) return null
      return artworkUrl.replace('100x100bb', '600x600bb')
    }

    return best.artworkUrl100.replace('100x100bb', '600x600bb')
  } catch {
    return null
  }
}
