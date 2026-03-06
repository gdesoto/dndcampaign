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
        icon: 'i-twemoji-house',
        active: path === base,
      },
      {
        label: 'Sessions',
        to: `${base}/sessions`,
        icon: 'i-twemoji-spiral-calendar',
        active: path.startsWith(`${base}/sessions`),
      },
      {
        label: 'Encounters',
        to: `${base}/encounters`,
        icon: 'i-twemoji-crossed-swords',
        active: path.startsWith(`${base}/encounters`),
      },
      {
        label: 'Dungeons',
        to: `${base}/dungeons`,
        icon: 'i-twemoji-castle',
        active: path.startsWith(`${base}/dungeons`),
      },
      {
        label: 'Characters',
        to: `${base}/characters`,
        icon: 'i-twemoji-busts-in-silhouette',
        active: path.startsWith(`${base}/characters`),
      },
      {
        label: 'Quests',
        to: `${base}/quests`,
        icon: 'i-twemoji-scroll',
        active: path.startsWith(`${base}/quests`),
      },
      {
        label: 'Milestones',
        to: `${base}/milestones`,
        icon: 'i-twemoji-triangular-flag',
        active: path.startsWith(`${base}/milestones`),
      },
      {
        label: 'Maps',
        to: `${base}/maps`,
        icon: 'i-twemoji-world-map',
        active: path.startsWith(`${base}/maps`),
      },
      {
        label: 'Journal',
        to: `${base}/journal`,
        icon: 'i-twemoji-notebook',
        active: path.startsWith(`${base}/journal`),
      },
      {
        label: 'Requests',
        to: `${base}/requests`,
        icon: 'i-twemoji-envelope-with-arrow',
        active: path.startsWith(`${base}/requests`),
      },
      {
        label: 'Calendar',
        to: `${base}/calendar`,
        icon: 'i-twemoji-tear-off-calendar',
        active: path.startsWith(`${base}/calendar`),
      },
      {
        label: 'Dice Roller',
        to: `${base}/dice-roller`,
        icon: 'i-twemoji-game-die',
        active: path.startsWith(`${base}/dice-roller`),
      },
      {
        label: 'Glossary',
        to: `${base}/glossary`,
        icon: 'i-twemoji-open-book',
        active: path.startsWith(`${base}/glossary`),
      },
      {
        label: 'Settings',
        to: `${base}/settings`,
        icon: 'i-twemoji-gear',
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
    if (suffix.startsWith('/dice-roller')) return 'Dice Roller'
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
