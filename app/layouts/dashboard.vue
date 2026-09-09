<script setup lang="ts">
import type { CampaignShell } from '#shared/types/campaign-workflow'

const route = useRoute()
const { request } = useApi()

const campaignId = computed(() => {
  const value = route.params.campaignId
  return typeof value === 'string' ? value : ''
})

const { data: campaign } = await useAsyncData(
  () => `dashboard-campaign-shell-${campaignId.value || 'none'}`,
  () => campaignId.value
    ? request<CampaignShell>(`/api/campaigns/${campaignId.value}`)
    : Promise.resolve(null),
  {
    watch: [campaignId],
  }
)

const asset = computed(() => {
  if (typeof route.params.recordingId === 'string') return { type: 'recordings', id: route.params.recordingId }
  if (typeof route.params.documentId === 'string') return { type: 'documents', id: route.params.documentId }
  return null
})

const { data: assetShell } = await useAsyncData(
  () => `dashboard-asset-shell-${campaignId.value}-${asset.value?.type || 'none'}-${asset.value?.id || 'none'}`,
  () => asset.value
    ? request<{ sessionId?: string | null, title?: string, filename?: string }>(`/api/${asset.value.type}/${asset.value.id}`)
    : Promise.resolve(null),
)

const sessionId = computed(() => {
  const value = route.params.sessionId
  return typeof value === 'string' ? value : (asset.value ? assetShell.value?.sessionId || '' : '')
})

const assetContext = computed(() => ({
  sessionId: sessionId.value,
  title: asset.value ? assetShell.value?.title || assetShell.value?.filename : undefined,
}))

const { data: sessionShell } = await useAsyncData(
  () => `dashboard-session-shell-${sessionId.value || 'none'}`,
  () => sessionId.value
    ? request<{ title: string, sessionNumber?: number | null }>(`/api/sessions/${sessionId.value}`)
    : Promise.resolve(null),
  {
    watch: [sessionId],
  }
)

const activeSessionTitle = computed(() => {
  if (!sessionShell.value?.title) return undefined
  if (!sessionShell.value.sessionNumber) return sessionShell.value.title
  return `#${sessionShell.value.sessionNumber} - ${sessionShell.value.title}`
})

const campaignHeaderDescription = computed(() => {
  const details = [
    campaign.value?.system || 'System not set',
    campaign.value?.dungeonMasterName ? `DM: ${campaign.value.dungeonMasterName}` : '',
  ].filter(Boolean)
  return details.join(' • ')
})

const {
  navItems,
  breadcrumbItems,
} = useCampaignNavigation(route, campaignId, campaign, activeSessionTitle, assetContext)

const navLinks = computed(() => {
  const items = navItems.value.map(({ active: _active, ...item }) => ({
    ...item,
    exact: item.label === 'Overview',
    // Nuxt's list index and detail records are siblings. Keep their section
    // highlighted on detail routes; ordinary links use native router activation.
    ...((item.label !== 'Overview' && route.path.startsWith(`${item.to}/`))
      || (item.label === 'Sessions' && asset.value) ? { active: true } : {}),
  }))
  const byLabel = new Map(items.map((item) => [item.label, item]))

  const sectionDefinitions = [
    {
      label: 'Campaign',
      labels: ['Overview', 'Characters', 'Calendar', 'Settings'],
    },
    {
      label: 'Session Play',
      labels: ['Sessions', 'Encounters', 'Dungeons', 'Journal', 'Requests'],
    },
    {
      label: 'World',
      labels: ['Quests', 'Milestones', 'Maps', 'Glossary'],
    },
    {
      label: 'Utilities',
      labels: ['Dice Roller'],
    },
  ]

  const grouped = sectionDefinitions.flatMap((section) => {
    const sectionItems = section.labels
      .map((label) => byLabel.get(label))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    if (!sectionItems.length) return []

    return [
      { label: section.label, type: 'label' as const },
      ...sectionItems,
    ]
  })

  return grouped
})
</script>

<template>
  <div class="theme-shell">
    <div class="theme-overlay theme-overlay-noise" aria-hidden="true" />
    <div class="theme-overlay theme-overlay-pattern" aria-hidden="true" />

    <div class="relative z-10 min-h-screen">
      <AppHeader />

      <UDashboardGroup class="fixed inset-x-0 bottom-0 top-[var(--ui-header-height)]">
        <UDashboardSidebar
          id="dmvault-campaign-sidebar"
          collapsible
          resizable
          :min-size="14"
          :default-size="18"
          :max-size="28"
          :collapsed-size="0"
          :menu="{ title: 'Campaign navigation', description: 'Choose a campaign section.' }"
          :ui="{
            root: 'min-h-0 h-full min-w-0',
            footer: 'border-t border-default',
          }"
        >
          <template #default="{ collapsed }">
            <UNavigationMenu
              v-if="!collapsed"
              :items="navLinks"
              aria-label="Campaign sections"
              highlight
              orientation="vertical"
              class="w-full px-1 pb-2"
              :ui="{ linkLabel: 'font-display tracking-[0.08em] uppercase text-md' }"
            />
          </template>

          <template #footer="{ collapsed }">
            <CampaignPartyFooter v-if="campaignId && !collapsed" :key="campaignId" :campaign-id="campaignId" />
          </template>
        </UDashboardSidebar>

        <UDashboardPanel
          id="dmvault-campaign-main"
          class="overflow-hidden"
          :ui="{ root: 'min-h-0 h-full', body: 'min-h-0 p-3 sm:p-5' }"
        >
          <template #header>
            <UDashboardNavbar :ui="{ root: 'h-auto min-h-(--ui-header-height) px-3 py-2 sm:px-5' }">
              <template #left>
                <div class="flex min-w-0 items-start gap-3">
                  <UDashboardSidebarCollapse size="md" square />
                  <div class="min-w-0">
                    <p class="type-record break-words">
                      {{ campaign?.name || 'Campaign' }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ campaignHeaderDescription }}
                    </p>
                  </div>
                </div>
              </template>
            </UDashboardNavbar>

            <div class="shrink-0 overflow-x-auto border-b border-default px-3 py-2 sm:px-5">
              <UBreadcrumb :items="breadcrumbItems" class="min-w-max" />
            </div>
          </template>
          <template #body>
            <div class="min-w-0"><slot /></div>
          </template>
        </UDashboardPanel>
      </UDashboardGroup>
    </div>
  </div>
</template>
