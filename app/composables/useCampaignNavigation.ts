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
        label: 'Encounters',
        to: `${base}/encounters`,
        icon: 'i-lucide-swords',
        active: path.startsWith(`${base}/encounters`),
      },
      {
        label: 'Dungeons',
        to: `${base}/dungeons`,
        icon: 'i-lucide-castle',
        active: path.startsWith(`${base}/dungeons`),
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
        label: 'Journal',
        to: `${base}/journal`,
        icon: 'i-lucide-notebook-tabs',
        active: path.startsWith(`${base}/journal`),
      },
      {
        label: 'Requests',
        to: `${base}/requests`,
        icon: 'i-lucide-message-square-share',
        active: path.startsWith(`${base}/requests`),
      },
      {
        label: 'Calendar',
        to: `${base}/calendar`,
        icon: 'i-lucide-calendar-range',
        active: path.startsWith(`${base}/calendar`),
      },
      {
        label: 'Tools',
        to: `${base}/tools`,
        icon: 'i-lucide-wrench',
        active: path.startsWith(`${base}/tools`),
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
    if (suffix.startsWith('/dungeons')) return 'Dungeons'
    if (suffix.startsWith('/encounters')) return 'Encounters'
    if (suffix.startsWith('/sessions/')) return 'Session details'
    if (suffix.startsWith('/sessions')) return 'Sessions'
    if (suffix.startsWith('/quests')) return 'Quests'
    if (suffix.startsWith('/milestones')) return 'Milestones'
    if (suffix.startsWith('/glossary')) return 'Glossary'
    if (suffix.startsWith('/maps')) return 'Maps'
    if (suffix.startsWith('/journal')) return 'Journal'
    if (suffix.startsWith('/requests')) return 'Requests'
    if (suffix.startsWith('/calendar')) return 'Calendar'
    if (suffix.startsWith('/tools')) return 'Tools'
    if (suffix.startsWith('/settings')) return 'Settings'
    if (suffix.startsWith('/documents')) return 'Document'
    if (suffix.startsWith('/recordings')) return 'Recording'
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
      const sessionPrefix = `/campaigns/${campaignId.value}/sessions/`
      const stepSegment = path.startsWith(sessionPrefix)
        ? path.slice(sessionPrefix.length).split('/')[1]
        : undefined
      const stepLabel = stepSegment
        ? stepSegment
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')
        : ''
      return [
        ...rootItems,
        { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
        { label: sessionTitle?.value || 'Session' },
        ...(stepLabel ? [{ label: stepLabel }] : []),
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/encounters/`)) {
      return [
        ...rootItems,
        { label: 'Encounters', to: `/campaigns/${campaignId.value}/encounters` },
        { label: 'Encounter' },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/dungeons/`)) {
      return [
        ...rootItems,
        { label: 'Dungeons', to: `/campaigns/${campaignId.value}/dungeons` },
        { label: 'Dungeon' },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/journal/`)) {
      return [
        ...rootItems,
        { label: 'Journal', to: `/campaigns/${campaignId.value}/journal` },
        { label: 'Entry' },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/recordings/`)) {
      return [
        ...rootItems,
        { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
        { label: 'Recording' },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/documents/`)) {
      return [
        ...rootItems,
        { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
        { label: 'Document' },
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
