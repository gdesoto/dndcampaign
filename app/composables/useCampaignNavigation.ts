import { computed, onMounted, watchEffect } from 'vue'
import type { CampaignShell } from '#shared/types/campaign-workflow'

export type CampaignRecordTitle = { path: string, title: string }

// Keyed by path so a previous record's title never labels another record.
export const useCampaignRecordTitle = () => useState<CampaignRecordTitle | null>('campaign-record-title', () => null)

// Detail pages name the last breadcrumb. Written after mount because the layout's
// breadcrumb renders before the page on the server; an SSR write would mismatch hydration.
export const trackCampaignRecordTitle = (title: () => string | undefined) => {
  const state = useCampaignRecordTitle()
  const route = useRoute()
  onMounted(() => watchEffect(() => {
    const value = title()
    if (value) state.value = { path: route.path, title: value }
  }))
}

export const useCampaignNavigation = (
  route: ReturnType<typeof useRoute>,
  campaignId: Ref<string>,
  campaign: Ref<CampaignShell | null | undefined>,
  sessionTitle?: Ref<string | undefined>,
  assetContext?: Ref<{ sessionId?: string, title?: string }>,
  recordTitle?: Ref<CampaignRecordTitle | null>,
) => {
  const recordLabel = (fallback: string) =>
    recordTitle?.value?.path === route.path ? recordTitle.value.title : fallback

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
        active: ['sessions', 'documents', 'recordings'].some(section => path === `${base}/${section}` || path.startsWith(`${base}/${section}/`)),
      },
      {
        label: 'Encounters',
        to: `${base}/encounters`,
        icon: 'i-twemoji-crossed-swords',
        active: path.startsWith(`${base}/encounters`),
      },
      {
        label: 'Encounter maps',
        to: `${base}/encounter-maps`,
        icon: 'i-twemoji-castle',
        active: path.startsWith(`${base}/encounter-maps`),
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
    if (suffix.startsWith('/watch')) return 'Recap playlist'
    if (suffix.startsWith('/characters')) return 'Characters'
    if (suffix.startsWith('/encounter-maps')) return 'Encounter maps'
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
        { label: sessionTitle?.value || 'Session', ...(stepLabel ? { to: `${sessionPrefix}${path.slice(sessionPrefix.length).split('/')[0]}` } : {}) },
        ...(stepLabel ? [{ label: stepLabel }] : []),
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/encounters/`)) {
      return [
        ...rootItems,
        { label: 'Encounters', to: `/campaigns/${campaignId.value}/encounters` },
        { label: recordLabel('Encounter') },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/encounter-maps/`)) {
      return [
        ...rootItems,
        { label: 'Encounter maps', to: `/campaigns/${campaignId.value}/encounter-maps` },
        { label: recordLabel('Encounter map') },
      ]
    }
    if (path.includes(`/campaigns/${campaignId.value}/journal/`)) {
      return [
        ...rootItems,
        { label: 'Journal', to: `/campaigns/${campaignId.value}/journal` },
        { label: recordLabel('Entry') },
      ]
    }
    if (path.startsWith(`/campaigns/${campaignId.value}/recordings/`) || path.startsWith(`/campaigns/${campaignId.value}/documents/`)) {
      const parentSessionId = assetContext?.value.sessionId
      return [
        ...rootItems,
        { label: 'Sessions', to: `/campaigns/${campaignId.value}/sessions` },
        ...(parentSessionId ? [{ label: sessionTitle?.value || 'Session', to: `/campaigns/${campaignId.value}/sessions/${parentSessionId}` }] : []),
        { label: assetContext?.value.title || sectionTitle.value },
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
