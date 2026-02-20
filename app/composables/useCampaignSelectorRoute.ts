const campaignSectionRoots = [
  '/sessions',
  '/quests',
  '/milestones',
  '/glossary',
  '/maps',
  '/tools',
  '/characters',
  '/settings',
] as const

export const resolveCampaignSelectorRoute = (
  currentPath: string,
  currentCampaignId: string | undefined,
  targetCampaignId: string
) => {
  if (targetCampaignId === 'all') return '/campaigns'
  if (!currentCampaignId) return `/campaigns/${targetCampaignId}`

  const campaignBase = `/campaigns/${currentCampaignId}`
  const targetBase = `/campaigns/${targetCampaignId}`
  if (!currentPath.startsWith(campaignBase)) return targetBase

  const suffix = currentPath.slice(campaignBase.length)
  if (suffix === '' || suffix === '/') return targetBase

  for (const section of campaignSectionRoots) {
    if (suffix === section) return `${targetBase}${section}`
    if (suffix.startsWith(`${section}/`)) return `${targetBase}${section}`
  }

  return targetBase
}
