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
  sectionTitle,
  breadcrumbItems,
} = useCampaignNavigation(route, campaignId, campaign, activeSessionTitle, assetContext)

const navLinks = computed(() => {
  const items = navItems.value
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
    <div class="theme-overlay theme-overlay-noise" />
    <div class="theme-overlay theme-overlay-pattern" />

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
          :ui="{
            root: 'min-h-0 h-full',
            footer: 'border-t border-default',
          }"
        >
          <UNavigationMenu
            :items="navLinks"
            orientation="vertical"
            class="w-full px-1 pb-2"
            :ui="{ linkLabel: 'font-display tracking-[0.08em] uppercase text-md' }"
          />

          <template #footer="{ collapsed }">
            <div class="w-full px-3 py-2.5">
              <div v-if="collapsed" class="flex justify-center">
                <ClientOnly><UColorModeButton variant="ghost" size="xs" class="shrink-0" /></ClientOnly>
              </div>

              <div v-else class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="font-display text-[13px] uppercase tracking-[0.12em] text-[var(--ui-text-dimmed)]">
                    Party
                  </p>
                  <ClientOnly><UColorModeButton variant="ghost" size="xs" class="shrink-0" /></ClientOnly>
                </div>

                <div class="flex items-center gap-1.5">
                  <UBadge variant="outline" size="sm" color="primary" class="min-w-8 justify-center">DM</UBadge>
                  <UBadge variant="soft" size="sm" color="neutral" class="min-w-8 justify-center">PC</UBadge>
                  <UBadge variant="soft" size="sm" color="neutral" class="min-w-8 justify-center">PC</UBadge>
                </div>
              </div>
            </div>
          </template>
        </UDashboardSidebar>

        <UDashboardPanel
id="dmvault-campaign-main"
          class="overflow-hidden"
          :ui="{ root: 'min-h-0 h-full' }"
        >
          <UDashboardNavbar>
            <template #left>
              <div class="flex min-w-0 items-start gap-3">
                <UDashboardSidebarCollapse size="xl" square class="hidden xl:inline-flex" />
                <div class="min-w-0">
                  <p class="font-display text-sm tracking-[0.08em] uppercase text-primary-500">
                    {{ campaign?.name || 'Campaign' }} • {{ sectionTitle }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ campaignHeaderDescription }}
                  </p>
                </div>
              </div>
            </template>
          </UDashboardNavbar>

          <div class="border-b border-default px-4 py-2 sm:px-6">
            <UBreadcrumb :items="breadcrumbItems" />
          </div>

          <div class="h-full overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <slot />
          </div>
        </UDashboardPanel>
      </UDashboardGroup>
    </div>
  </div>
</template>
