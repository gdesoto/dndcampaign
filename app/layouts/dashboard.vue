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
} = useCampaignNavigation(route, campaignId, campaign)

const navLinks = computed(() => {
  const items = navItems.value
  const sessionsIndex = items.findIndex((item) => item.label === 'Sessions')
  const toolsIndex = items.findIndex((item) => item.label === 'Tools')

  const campaignItems = sessionsIndex > -1 ? items.slice(0, sessionsIndex) : items
  const sessionItems = sessionsIndex > -1
    ? (toolsIndex > -1 ? items.slice(sessionsIndex, toolsIndex) : items.slice(sessionsIndex))
    : []
  const utilityItems = toolsIndex > -1 ? items.slice(toolsIndex) : []

  return [
    { label: 'Campaign', type: 'label' as const },
    ...campaignItems,
    ...(sessionItems.length ? [{ label: 'Sessions', type: 'label' as const }, ...sessionItems] : []),
    ...(utilityItems.length ? [{ label: 'Utilities', type: 'label' as const }, ...utilityItems] : []),
  ]
})
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <UDashboardGroup class="fixed inset-x-0 bottom-0 top-[var(--ui-header-height)]">
      <UDashboardSidebar
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
              <UColorModeButton variant="ghost" size="xs" class="shrink-0" />
            </div>

            <div v-else class="space-y-2">
              <div class="flex items-center justify-between gap-2">
                <p class="font-display text-[13px] uppercase tracking-[0.12em] text-[var(--ui-text-dimmed)]">
                  Party
                </p>
                <UColorModeButton variant="ghost" size="xs" class="shrink-0" />
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
        class="overflow-hidden"
        :ui="{ root: 'min-h-0 h-full' }"
      >
        <UDashboardNavbar>
          <template #leading>
            <div class="flex min-w-0 items-start gap-3">
              <UDashboardSidebarCollapse size="xl" square class="hidden xl:inline-flex" />
              <div class="min-w-0">
                <p class="font-display text-sm tracking-[0.08em] uppercase text-primary-500">
                  {{ campaign?.name || 'Campaign' }} · {{ sectionTitle }}
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
</template>
