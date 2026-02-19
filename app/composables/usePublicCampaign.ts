export const usePublicCampaign = () => {
  const { request } = useApi()

  const listCampaigns = (input?: { search?: string; limit?: number; random?: boolean }) => {
    const query = new URLSearchParams()
    if (input?.search) query.set('search', input.search)
    if (typeof input?.limit === 'number') query.set('limit', String(input.limit))
    if (typeof input?.random === 'boolean') query.set('random', input.random ? '1' : '0')
    const suffix = query.toString()
    return request<
      Array<{
        publicSlug: string
        publicUrl: string
        name: string
        system: string
        description: string | null
        dungeonMasterName: string | null
        updatedAt: string
      }>
    >(`/api/public/campaigns${suffix ? `?${suffix}` : ''}`)
  }

  const getOverview = (publicSlug: string) =>
    request<{
      campaign: {
        name: string
        system: string
        description: string | null
        dungeonMasterName: string | null
      }
      sections: {
        showCharacters: boolean
        showRecaps: boolean
        showSessions: boolean
        showGlossary: boolean
        showQuests: boolean
        showMilestones: boolean
        showMaps: boolean
      }
    }>(`/api/public/campaigns/${publicSlug}`)

  const getCharacters = (publicSlug: string) =>
    request<
      Array<{
        name: string
        status: string | null
        portraitUrl: string | null
        campaignStatus: string
        roleLabel: string | null
        notes: string | null
      }>
    >(`/api/public/campaigns/${publicSlug}/characters`)

  const getRecaps = (publicSlug: string) =>
    request<
      Array<{
        id: string
        filename: string
        durationSeconds: number | null
        createdAt: string
        session: {
          id: string
          title: string
          sessionNumber: number | null
          playedAt: string | null
        }
      }>
    >(`/api/public/campaigns/${publicSlug}/recaps`)

  const getRecapPlaybackUrl = (publicSlug: string, recapId: string) =>
    request<{ url: string }>(`/api/public/campaigns/${publicSlug}/recaps/${recapId}/playback-url`)

  const getSessions = (publicSlug: string) =>
    request<
      Array<{
        title: string
        sessionNumber: number | null
        playedAt: string | null
        notes: string | null
        createdAt: string
      }>
    >(`/api/public/campaigns/${publicSlug}/sessions`)

  const getGlossary = (publicSlug: string) =>
    request<
      Array<{
        type: string
        name: string
        aliases: string | null
        description: string
        sessions: Array<{
          session: {
            title: string
            sessionNumber: number | null
            playedAt: string | null
          }
        }>
      }>
    >(`/api/public/campaigns/${publicSlug}/glossary`)

  const getQuests = (publicSlug: string) =>
    request<
      Array<{
        title: string
        description: string | null
        type: string
        status: string
        progressNotes: string | null
        sortOrder: number
        createdAt: string
      }>
    >(`/api/public/campaigns/${publicSlug}/quests`)

  const getMilestones = (publicSlug: string) =>
    request<
      Array<{
        title: string
        description: string | null
        isComplete: boolean
        completedAt: string | null
        createdAt: string
      }>
    >(`/api/public/campaigns/${publicSlug}/milestones`)

  const getMaps = (publicSlug: string) =>
    request<
      Array<{
        name: string
        slug: string
        isPrimary: boolean
        status: string
        createdAt: string
      }>
    >(`/api/public/campaigns/${publicSlug}/maps`)

  const getMapViewer = (publicSlug: string, mapSlug: string) =>
    request<import('#shared/types/api/map').CampaignMapViewerDto>(
      `/api/public/campaigns/${publicSlug}/maps/${mapSlug}/viewer`
    )

  const getMapSvgUrl = (publicSlug: string, mapSlug: string) =>
    `/api/public/campaigns/${publicSlug}/maps/${mapSlug}/svg`

  return {
    listCampaigns,
    getOverview,
    getCharacters,
    getRecaps,
    getRecapPlaybackUrl,
    getSessions,
    getGlossary,
    getQuests,
    getMilestones,
    getMaps,
    getMapViewer,
    getMapSvgUrl,
  }
}
