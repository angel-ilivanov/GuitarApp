import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'

vi.mock('../TabRenderer', () => ({
  default: vi.fn(() => <div data-testid="tab-renderer" />),
}))

vi.mock('../TakeThumbnail', () => ({
  default: vi.fn(({ alt = 'Take thumbnail' }: { alt?: string }) => <div data-testid="take-thumbnail">{alt}</div>),
}))

vi.mock('../TakeToast', () => ({
  default: vi.fn(() => null),
}))

vi.mock('plyr', () => ({
  default: class MockPlyr {
    on(_event: string, cb: () => void) {
      cb()
    }

    play() {
      return Promise.resolve()
    }

    destroy() {}
  },
}))

function makeTake(overrides: Partial<Take> = {}): Take {
  return {
    id: 'take-1',
    takeNumber: 1,
    speed: 100,
    filePath: '/takes/take-1.webm',
    createdAt: '2026-04-01T10:00:00.000Z',
    rating: 4,
    name: 'Solo Attempt 1',
    ...overrides,
  }
}

function makeSong(overrides: Partial<Song> = {}): Song {
  return {
    id: 'song-1',
    title: 'Kickapoo',
    artist: 'Tenacious D',
    bpm: 120,
    tuning: 'E Std',
    paths: { tabFile: '/tabs/kickapoo.gp', takesFolder: '/takes/kickapoo' },
    takes: [makeTake()],
    nextTakeNumber: 2,
    lastOpened: Date.parse('2026-04-02T10:00:00.000Z'),
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'uuid-1' },
      configurable: true,
    })

    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      configurable: true,
    })

    Object.defineProperty(window, 'electronAPI', {
      value: {
        isElectron: true,
        openFileDialog: vi.fn(),
        loadSongFile: vi.fn(),
        updateSong: vi.fn(),
        saveVideoTake: vi.fn(),
        getTakesForSong: vi.fn().mockResolvedValue([]),
        deleteTake: vi.fn().mockResolvedValue({ success: true }),
        renameTake: vi.fn(),
        updateTakeRating: vi.fn(),
        getAllSongs: vi.fn().mockResolvedValue([
          makeSong({
            takes: [
              makeTake({ id: 'take-1', rating: 4, name: 'Solo Attempt 1' }),
            ],
          }),
        ]),
        showInFolder: vi.fn(),
        clearLibrary: vi.fn(),
      },
      configurable: true,
    })

    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve())
    HTMLMediaElement.prototype.pause = vi.fn()
    HTMLMediaElement.prototype.load = vi.fn()
  })

  it('switches between Play and Takes Library tabs', async () => {
    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    expect(await screen.findByText('Review every recorded pass, filter the strongest takes, and jump into playback without leaving the workspace.')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0])
    expect(await screen.findByText('Open a tab, load a recent song, and keep the workspace ready for recording.')).toBeTruthy()
  })

  it('shows the empty state when a filter has no matching takes', async () => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        ...window.electronAPI,
        getAllSongs: vi.fn().mockResolvedValue([
          makeSong({
            takes: [makeTake({ id: 'take-2', rating: 4, name: 'Warmup' })],
          }),
        ]),
      },
      configurable: true,
    })

    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    fireEvent.click(screen.getByRole('button', { name: '5 Stars' }))

    expect(await screen.findByText('No matching takes')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Show All Takes' })).toBeTruthy()
  })

  it('switches the sidebar into review mode when clicking a take row in the library', async () => {
    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Kickapoo/i })[1])

    fireEvent.click(screen.getByTestId('take-row-song-1-take-1'))

    expect(await screen.findByText('Review Deck')).toBeTruthy()
    expect(screen.getByText('Take Preview')).toBeTruthy()
  })

  it('opens the theater overlay from the secondary expand action', async () => {
    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Kickapoo/i })[1])

    const expandButtons = screen.getAllByRole('button', { name: 'Expand' })
    fireEvent.click(expandButtons[0])

    expect(await screen.findByRole('button', { name: 'Close theater mode' })).toBeTruthy()
    expect(screen.getByText('Show in Folder')).toBeTruthy()
  })

  it('switching back to the Play tab exits review mode and returns the sidebar to Live Feed', async () => {
    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Kickapoo/i })[1])
    fireEvent.click(screen.getByTestId('take-row-song-1-take-1'))
    expect(await screen.findByText('Review Deck')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Play' })[0])

    expect(await screen.findByText('Control Deck')).toBeTruthy()
    expect(screen.getByText('Live Feed')).toBeTruthy()
  })

  it('updating a take rating in review mode does not reload the current take video', async () => {
    render(<App />)

    await waitFor(() => expect(window.electronAPI?.getAllSongs).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Takes Library' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Kickapoo/i })[1])
    fireEvent.click(screen.getByTestId('take-row-song-1-take-1'))
    expect(await screen.findByText('Review Deck')).toBeTruthy()

    const reviewDeck = screen.getByTestId('review-deck')
    const loadMock = HTMLMediaElement.prototype.load as unknown as ReturnType<typeof vi.fn>
    const playMock = HTMLMediaElement.prototype.play as unknown as ReturnType<typeof vi.fn>
    const loadCallsBefore = loadMock.mock.calls.length
    const playCallsBefore = playMock.mock.calls.length

    fireEvent.click(within(reviewDeck).getByRole('button', { name: 'Rate 5 stars' }))

    await waitFor(() => expect(window.electronAPI?.updateTakeRating).toHaveBeenCalledWith('song-1', 'take-1', 5))
    expect(loadMock.mock.calls.length).toBe(loadCallsBefore)
    expect(playMock.mock.calls.length).toBe(playCallsBefore)
  })
})
