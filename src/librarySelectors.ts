import { sortTakesByMostRecent } from './takeUtils'

export type LibraryFilter = 'none' | 'fiveStars' | 'fourPlus' | 'mostRecent'
export type SidebarMode = 'recording' | 'reviewing'
export type LeftView = 'play' | 'takesLibrary'

export interface FilteredSongGroup {
  song: Song
  visibleTakes: Take[]
}

export function filterTakesForLibrary(takes: Take[], filter: LibraryFilter): Take[] {
  const sortedTakes = sortTakesByMostRecent(takes)

  switch (filter) {
    case 'fiveStars':
      return sortedTakes.filter((take) => (take.rating ?? 0) === 5)
    case 'fourPlus':
      return sortedTakes.filter((take) => (take.rating ?? 0) >= 4)
    case 'mostRecent':
    case 'none':
    default:
      return sortedTakes
  }
}

export function getSongsForLibrary(songs: Song[], filter: LibraryFilter): FilteredSongGroup[] {
  return [...songs]
    .sort((a, b) => b.lastOpened - a.lastOpened)
    .map((song) => ({
      song,
      visibleTakes: filterTakesForLibrary(song.takes ?? [], filter),
    }))
    .filter((group) => group.visibleTakes.length > 0)
}
