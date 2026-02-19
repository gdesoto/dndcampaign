type CampaignPublicAccessOwnerDto = {
  campaignId: string
  isEnabled: boolean
  isListed: boolean
  publicSlug: string
  publicUrl: string
  showCharacters: boolean
  showRecaps: boolean
  showSessions: boolean
  showGlossary: boolean
  showQuests: boolean
  showMilestones: boolean
  showMaps: boolean
  updatedAt: string
}

type CampaignPublicAccessUpdateInput = Partial<{
  isEnabled: boolean
  isListed: boolean
  showCharacters: boolean
  showRecaps: boolean
  showSessions: boolean
  showGlossary: boolean
  showQuests: boolean
  showMilestones: boolean
  showMaps: boolean
}>

export const useCampaignPublicAccess = () => {
  const { request } = useApi()

  const getSettings = (campaignId: string) =>
    request<CampaignPublicAccessOwnerDto>(`/api/campaigns/${campaignId}/public-access`)

  const updateSettings = (campaignId: string, payload: CampaignPublicAccessUpdateInput) =>
    request<CampaignPublicAccessOwnerDto>(`/api/campaigns/${campaignId}/public-access`, {
      method: 'PATCH',
      body: payload,
    })

  const regenerateSlug = (campaignId: string) =>
    request<CampaignPublicAccessOwnerDto>(
      `/api/campaigns/${campaignId}/public-access/regenerate-slug`,
      {
        method: 'POST',
      }
    )

  const getPublicOverview = (publicSlug: string) =>
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

  return {
    getSettings,
    updateSettings,
    regenerateSlug,
    getPublicOverview,
  }
}
