import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SongCard from '../SongCard'

function makeSong(overrides: Partial<SongObject> = {}): SongObject {
  return {
    id: 'test-id-123',
    title: 'Master of Puppets',
    artist: 'Metallica',
    bpm: 212,
    nextTakeNumber: 1,
    paths: { tabFile: '/path/to/file.gp', takesFolder: '/path/to/takes' },
    stats: { totalTakes: 5 },
    ...overrides,
  }
}

describe('SongCard', () => {
  it('renders album art image when albumArt is provided', () => {
    const song = makeSong({ albumArt: 'https://example.com/cover.jpg' })
    render(<SongCard song={song} onClick={vi.fn()} />)

    const img = screen.getByAltText('Master of Puppets cover') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.src).toBe('https://example.com/cover.jpg')
  })

  it('renders gradient fallback when albumArt is not provided', () => {
    const song = makeSong({ albumArt: undefined })
    const { container } = render(<SongCard song={song} onClick={vi.fn()} />)

    // No <img> should be present
    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBe(0)

    // A div with a gradient background style should exist
    const gradientDiv = container.querySelector('[style*="linear-gradient"]')
    expect(gradientDiv).toBeTruthy()
  })

  it('displays song title, artist, takes count, and tuning', () => {
    const song = makeSong({ tuning: 'Drop D' })
    render(<SongCard song={song} onClick={vi.fn()} />)

    expect(screen.getByText('Master of Puppets')).toBeTruthy()
    expect(screen.getByText('Metallica')).toBeTruthy()
    expect(screen.getByText('5 takes')).toBeTruthy()
    expect(screen.getByText('Drop D')).toBeTruthy()
  })

  it('shows "E Std" as default tuning when not specified', () => {
    const song = makeSong()
    render(<SongCard song={song} onClick={vi.fn()} />)

    expect(screen.getByText('E Std')).toBeTruthy()
  })
})
