import { describe, expect, it } from 'vitest'
import { filterTakesForLibrary, getSongsForLibrary, type LibraryFilter } from '../librarySelectors'

function makeTake(overrides: Partial<Take> = {}): Take {
  return {
    id: crypto.randomUUID(),
    takeNumber: 1,
    speed: 100,
    filePath: '/takes/test.webm',
    createdAt: '2026-04-01T10:00:00.000Z',
    rating: 0,
    ...overrides,
  }
}

function makeSong(id: string, takes: Take[]): Song {
  return {
    id,
    title: `Song ${id}`,
    artist: 'Test Artist',
    bpm: 120,
    tuning: 'E Standard',
    paths: { tabFile: `/tabs/${id}.gp`, takesFolder: `/takes/${id}` },
    takes,
    nextTakeNumber: takes.length + 1,
    lastOpened: Date.parse('2026-04-02T10:00:00.000Z'),
    createdAt: '2026-04-01T00:00:00.000Z',
  }
}

describe('filterTakesForLibrary', () => {
  const takes = [
    makeTake({ id: 'older', rating: 5, createdAt: '2026-04-01T08:00:00.000Z' }),
    makeTake({ id: 'newer', rating: 4, createdAt: '2026-04-01T10:00:00.000Z' }),
    makeTake({ id: 'lowest', rating: 2, createdAt: '2026-04-01T09:00:00.000Z' }),
  ]

  it.each<[LibraryFilter, string[]]>([
    ['none', ['newer', 'lowest', 'older']],
    ['mostRecent', ['newer', 'lowest', 'older']],
    ['fiveStars', ['older']],
    ['fourPlus', ['newer', 'older']],
  ])('applies the %s filter', (filter, expectedIds) => {
    expect(filterTakesForLibrary(takes, filter).map((take) => take.id)).toEqual(expectedIds)
  })
})

describe('getSongsForLibrary', () => {
  it('hides songs that do not have matching takes under the active filter', () => {
    const songs = [
      makeSong('a', [makeTake({ id: 'a1', rating: 5 })]),
      makeSong('b', [makeTake({ id: 'b1', rating: 3 })]),
    ]

    const result = getSongsForLibrary(songs, 'fiveStars')

    expect(result).toHaveLength(1)
    expect(result[0].song.id).toBe('a')
    expect(result[0].visibleTakes).toHaveLength(1)
  })

  it('returns visible take counts that the accordion can use for badges', () => {
    const songs = [
      makeSong('a', [
        makeTake({ id: 'a1', rating: 5, createdAt: '2026-04-01T08:00:00.000Z' }),
        makeTake({ id: 'a2', rating: 4, createdAt: '2026-04-01T09:00:00.000Z' }),
      ]),
    ]

    const result = getSongsForLibrary(songs, 'fourPlus')

    expect(result[0].visibleTakes.map((take) => take.id)).toEqual(['a2', 'a1'])
    expect(result[0].visibleTakes).toHaveLength(2)
  })
})
