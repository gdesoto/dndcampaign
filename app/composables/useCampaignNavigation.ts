import { computed } from 'vue'

type CampaignShell = {
  id: string
  name: string
  system?: string | null
  dungeonMasterName?: string | null
}

export const useCampaignNavigation = (
  route: ReturnType<typeof useRoute>,
  campaignId: Ref<string>,
  campaign: Ref<CampaignShell | null | undefined>
) => {
  const navItems = computed(() => [
    { label: 'Overview', to: `/campaigns/${campaignId.value}`, icon: 'i-lucide-layout-dashboard' },
    { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions`, icon: 'i-lucide-calendar-days' },
    { label: 'Characters', to: `/campaigns/${campaignId.value}/characters`, icon: 'i-lucide-users' },
    { label: 'Quests', to: `/campaigns/${campaignId.value}/quests`, icon: 'i-lucide-scroll-text' },
    { label: 'Milestones', to: `/campaigns/${campaignId.value}/milestones`, icon: 'i-lucide-flag' },
    { label: 'Glossary', to: `/campaigns/${campaignId.value}/glossary`, icon: 'i-lucide-book-open-text' },
    { label: 'Settings', to: `/campaigns/${campaignId.value}/settings`, icon: 'i-lucide-settings' },
  ])

  const sectionFromPath = (path: string) => {
    const campaignBase = `/campaigns/${campaignId.value}`
    const suffix = path.startsWith(campaignBase) ? path.slice(campaignBase.length) : ''
    if (suffix === '' || suffix === '/') return 'Overview'
    if (suffix.startsWith('/characters')) return 'Characters'
    if (suffix.startsWith('/sessions/')) return 'Session details'
    if (suffix.startsWith('/sessions')) return 'Sessions'
    if (suffix.startsWith('/quests')) return 'Quests'
    if (suffix.startsWith('/milestones')) return 'Milestones'
    if (suffix.startsWith('/glossary')) return 'Glossary'
    if (suffix.startsWith('/settings')) return 'Settings'
    return 'Overview'
  }

  const sectionTitle = computed(() => sectionFromPath(route.path))

  const breadcrumbItems = computed(() => {
    const rootItems = [
      { label: 'Campaigns', to: '/campaigns' },
      { label: campaign.value?.name || 'Campaign', to: `/campaigns/${campaignId.value}` },
    ]

    const path = route.path
    if (path === `/campaigns/${campaignId.value}`) {
      return rootItems
    }
    if (path.includes(`/campaigns/${campaignId.value}/sessions/`)) {
      return [
        ...rootItems,
        { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
        { label: 'Session details' },
      ]
    }
    return [...rootItems, { label: sectionTitle.value }]
  })

  return {
    navItems,
    sectionTitle,
    breadcrumbItems,
  }
}
