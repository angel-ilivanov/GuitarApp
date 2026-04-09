export function formatTakeDate(iso: string): string {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return `${datePart}, ${timePart}`
}

export function getTakeDisplayName(take: Take): string {
  return take.name || `Take #${take.takeNumber}`
}

export function sortTakesByMostRecent(takes: Take[]): Take[] {
  return [...takes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function takeVideoUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return `take-video://file/${encodeURIComponent(normalized)}`
}
