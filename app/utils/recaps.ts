type RecapWithSessionNumber = {
  createdAt?: string | null
  session: {
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

export const sortRecapsByReverseSessionNumber = <T extends RecapWithSessionNumber>(
  recaps: T[] | null | undefined
) => {
  if (!recaps?.length) return [] as T[]

  return [...recaps].sort((a, b) => {
    const aSessionNumber = a.session.sessionNumber ?? Number.NEGATIVE_INFINITY
    const bSessionNumber = b.session.sessionNumber ?? Number.NEGATIVE_INFINITY
    if (aSessionNumber !== bSessionNumber) return bSessionNumber - aSessionNumber

    const aDate = new Date(a.session.playedAt || a.createdAt || '').getTime() || 0
    const bDate = new Date(b.session.playedAt || b.createdAt || '').getTime() || 0
    return bDate - aDate
  })
}
