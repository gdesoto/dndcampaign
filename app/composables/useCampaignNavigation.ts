import { computed } from 'vue'
import type { CampaignShell } from '#shared/types/campaign-workflow'

export const useCampaignNavigation = (
  route: ReturnType<typeof useRoute>,
  campaignId: Ref<string>,
  campaign: Ref<CampaignShell | null | undefined>,
  sessionTitle?: Ref<string | undefined>
) => {
  const navItems = computed(() => {
    const base = `/campaigns/${campaignId.value}`
    const path = route.path

    return [
      {
        label: 'Overview',
        to: base,
        icon: 'i-lucide-layout-dashboard',
        active: path === base,
      },
      {
        label: 'Sessions',
        to: `${base}/sessions`,
        icon: 'i-lucide-calendar-days',
        active: path.startsWith(`${base}/sessions`),
      },
      {
        label: 'Characters',
        to: `${base}/characters`,
        icon: 'i-lucide-users',
        active: path.startsWith(`${base}/characters`),
      },
      {
        label: 'Quests',
        to: `${base}/quests`,
        icon: 'i-lucide-scroll-text',
        active: path.startsWith(`${base}/quests`),
      },
      {
        label: 'Milestones',
        to: `${base}/milestones`,
        icon: 'i-lucide-flag',
        active: path.startsWith(`${base}/milestones`),
      },
      {
        label: 'Maps',
        to: `${base}/maps`,
        icon: 'i-lucide-map',
        active: path.startsWith(`${base}/maps`),
      },
      {
        label: 'Glossary',
        to: `${base}/glossary`,
        icon: 'i-lucide-book-open-text',
        active: path.startsWith(`${base}/glossary`),
      },
      {
        label: 'Settings',
        to: `${base}/settings`,
        icon: 'i-lucide-settings',
        active: path.startsWith(`${base}/settings`),
      },
    ]
  })

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
    if (suffix.startsWith('/maps')) return 'Maps'
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
        { label: sessionTitle?.value || 'Session' },
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
