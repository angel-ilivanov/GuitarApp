import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { fetchAlbumArt, filterByArtist, filterByTrack, selectBestResult, type ITunesResult } from '../iTunesApi'

let fetchSpy: MockInstance

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('filterByArtist', () => {
  const results: ITunesResult[] = [
    { trackName: 'Mr. Brownstone', artistName: "Guns N' Roses", collectionName: 'Appetite for Destruction' },
    { trackName: 'Mr. Brownstone', artistName: 'Strings of Fire', collectionName: "Acoustic Tribute to Guns N' Roses" },
    { trackName: 'Mr. Brownstone', artistName: 'Karaoke Band', collectionName: 'Karaoke Hits' },
  ]

  it('filters out tribute bands by strict artist match', () => {
    const filtered = filterByArtist(results, "Guns N' Roses")
    expect(filtered).toHaveLength(1)
    expect(filtered[0].artistName).toBe("Guns N' Roses")
  })

  it('handles smart quotes in artist names', () => {
    const withSmartQuote: ITunesResult[] = [
      { trackName: 'Mr. Brownstone', artistName: "Guns N\u2019 Roses", collectionName: 'Appetite for Destruction' },
    ]
    const filtered = filterByArtist(withSmartQuote, "Guns N' Roses")
    expect(filtered).toHaveLength(1)
  })
})

describe('filterByTrack', () => {
  it('keeps only results whose trackName contains the title', () => {
    const results: ITunesResult[] = [
      { trackName: 'Welcome to the Jungle', collectionName: 'Appetite for Destruction' },
      { trackName: 'Mr. Brownstone', collectionName: 'Appetite for Destruction' },
    ]
    const filtered = filterByTrack(results, 'Mr. Brownstone')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].trackName).toBe('Mr. Brownstone')
  })
})

describe('selectBestResult', () => {
  it('picks studio album from track matches (Bucket A)', () => {
    const trackMatches: ITunesResult[] = [
      { trackName: 'Californication', collectionName: 'Greatest Hits', releaseDate: '2003-11-18T00:00:00Z' },
      { trackName: 'Californication', collectionName: 'Californication', releaseDate: '1999-06-08T00:00:00Z' },
      { trackName: 'Californication', collectionName: 'Live at Slane Castle', releaseDate: '2003-11-21T00:00:00Z' },
    ]
    const best = selectBestResult(trackMatches, trackMatches)
    expect(best?.collectionName).toBe('Californication')
  })

  it('falls back to artist studio album when track only has live matches', () => {
    // This is the real Mr. Brownstone scenario:
    // - Only track match is a live version
    // - But other GNR songs from Appetite for Destruction are in the artist results
    const trackMatches: ITunesResult[] = [
      { trackName: 'Mr. Brownstone (Live)', collectionName: "Live Era '87-'93", releaseDate: '1999-11-23T00:00:00Z' },
    ]
    const artistMatches: ITunesResult[] = [
      { trackName: 'Mr. Brownstone (Live)', collectionName: "Live Era '87-'93", releaseDate: '1999-11-23T00:00:00Z' },
      { trackName: 'Welcome To The Jungle', collectionName: 'Appetite For Destruction', releaseDate: '1987-07-21T00:00:00Z' },
      { trackName: 'Sweet Child O\' Mine', collectionName: 'Appetite For Destruction', releaseDate: '1987-07-21T00:00:00Z' },
      { trackName: 'November Rain', collectionName: 'Use Your Illusion I', releaseDate: '1991-09-17T00:00:00Z' },
    ]
    const best = selectBestResult(trackMatches, artistMatches)
    expect(best?.collectionName).toBe('Appetite For Destruction')
  })

  it('picks oldest studio album when multiple Bucket A results exist', () => {
    const results: ITunesResult[] = [
      { trackName: 'Song', collectionName: 'Album 2020', releaseDate: '2020-01-01T00:00:00Z' },
      { trackName: 'Song', collectionName: 'Album 1995', releaseDate: '1995-06-01T00:00:00Z' },
    ]
    const best = selectBestResult(results, results)
    expect(best?.collectionName).toBe('Album 1995')
  })

  it('falls back to Bucket B (oldest) when no studio albums exist at all', () => {
    const results: ITunesResult[] = [
      { trackName: 'Song', collectionName: 'Greatest Hits Vol 2', releaseDate: '2010-01-01T00:00:00Z' },
      { trackName: 'Song', collectionName: 'Live at Wembley', releaseDate: '2000-06-01T00:00:00Z' },
    ]
    const best = selectBestResult(results, results)
    expect(best?.collectionName).toBe('Live at Wembley')
  })

  it('returns null for empty input', () => {
    expect(selectBestResult([], [])).toBeNull()
  })
})

describe('fetchAlbumArt', () => {
  it('returns a scaled album art URL for "Master of Puppets" by "Metallica"', async () => {
    const mockResponse = {
      resultCount: 1,
      results: [
        {
          trackName: 'Master of Puppets',
          artworkUrl100: 'https://example.com/mop/100x100bb.jpg',
          collectionName: 'Master of Puppets',
          artistName: 'Metallica',
          releaseDate: '1986-03-03T00:00:00Z',
        },
      ],
    }

    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response)

    const result = await fetchAlbumArt('Master of Puppets', 'Metallica')

    expect(result).toContain('600x600')
    expect(result).not.toContain('100x100')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('Metallica%20Master%20of%20Puppets')
    )
  })

  it('picks original Californication album over Greatest Hits and Live', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { trackName: 'Californication', artworkUrl100: 'https://example.com/greatest/100x100bb.jpg', collectionName: 'Greatest Hits', artistName: 'Red Hot Chili Peppers', releaseDate: '2003-11-18T00:00:00Z' },
          { trackName: 'Californication', artworkUrl100: 'https://example.com/californication/100x100bb.jpg', collectionName: 'Californication', artistName: 'Red Hot Chili Peppers', releaseDate: '1999-06-08T00:00:00Z' },
          { trackName: 'Californication', artworkUrl100: 'https://example.com/live/100x100bb.jpg', collectionName: 'Live at Slane Castle', artistName: 'Red Hot Chili Peppers', releaseDate: '2003-11-21T00:00:00Z' },
        ],
      }),
    } as Response)

    const result = await fetchAlbumArt('Californication', 'Red Hot Chili Peppers')
    expect(result).toBe('https://example.com/californication/600x600bb.jpg')
  })

  it('picks Appetite for Destruction for "Mr. Brownstone" even when only live track match exists', async () => {
    // Mirrors real iTunes API: only GNR "Mr. Brownstone" result is the live version,
    // but other Appetite for Destruction tracks exist in the results
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { trackName: 'Mr. Brownstone (Live)', artworkUrl100: 'https://example.com/live-era/100x100bb.jpg', collectionName: "Live Era '87-'93", artistName: "Guns N' Roses", releaseDate: '1999-11-23T00:00:00Z' },
          { trackName: 'Welcome To The Jungle', artworkUrl100: 'https://example.com/appetite/100x100bb.jpg', collectionName: 'Appetite For Destruction', artistName: "Guns N' Roses", releaseDate: '1987-07-21T00:00:00Z' },
          { trackName: 'Sweet Child O\' Mine', artworkUrl100: 'https://example.com/appetite/100x100bb.jpg', collectionName: 'Appetite For Destruction', artistName: "Guns N' Roses", releaseDate: '1987-07-21T00:00:00Z' },
          { trackName: 'Mr. Brownstone', artworkUrl100: 'https://example.com/lullaby/100x100bb.jpg', collectionName: "Lullaby Renditions of Guns N' Roses", artistName: 'Rockabye Baby!', releaseDate: '2009-11-10T00:00:00Z' },
          { trackName: 'Mr. Brownstone', artworkUrl100: 'https://example.com/tribute/100x100bb.jpg', collectionName: "The Acoustic Tribute To Guns N' Roses", artistName: 'Stripped Down Sounds', releaseDate: '2000-09-12T00:00:00Z' },
          { trackName: 'November Rain', artworkUrl100: 'https://example.com/uyi/100x100bb.jpg', collectionName: 'Use Your Illusion I', artistName: "Guns N' Roses", releaseDate: '1991-09-17T00:00:00Z' },
        ],
      }),
    } as Response)

    const result = await fetchAlbumArt('Mr. Brownstone', "Guns N' Roses")
    expect(result).toBe('https://example.com/appetite/600x600bb.jpg')
  })

  it('prefers oldest studio release over newer one', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        results: [
          { trackName: 'Enter Sandman', artworkUrl100: 'https://example.com/reissue/100x100bb.jpg', collectionName: 'Metallica (Reissue)', artistName: 'Metallica', releaseDate: '2021-01-01T00:00:00Z' },
          { trackName: 'Enter Sandman', artworkUrl100: 'https://example.com/original/100x100bb.jpg', collectionName: 'Metallica (The Black Album)', artistName: 'Metallica', releaseDate: '1991-08-12T00:00:00Z' },
        ],
      }),
    } as Response)

    const result = await fetchAlbumArt('Enter Sandman', 'Metallica')
    expect(result).toBe('https://example.com/original/600x600bb.jpg')
  })

  it('returns null for an unknown song (no results)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ resultCount: 0, results: [] }),
    } as Response)

    expect(await fetchAlbumArt('xyzzy_nonexistent', 'Nobody')).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    expect(await fetchAlbumArt('Some Song', 'Some Artist')).toBeNull()
  })

  it('returns null when both title and artist are empty', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await fetchAlbumArt('', '')).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
