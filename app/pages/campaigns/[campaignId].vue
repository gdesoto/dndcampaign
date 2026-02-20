<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)

const sessionId = computed(() =>
  typeof route.params.sessionId === 'string' ? route.params.sessionId : ''
)

const isSessionDetailRoute = computed(() =>
  route.path.includes(`/campaigns/${campaignId.value}/sessions/`) && Boolean(sessionId.value)
)

const {
  campaign,
  sessionHeader,
  access,
  canWriteContent,
  pending,
  error,
  refreshCampaign,
} = await useCampaignWorkspace({
  campaignId,
  sessionId,
  isSessionDetailRoute,
})

const activeSessionTitle = computed(() => sessionHeader.value?.title || undefined)

const { navItems, sectionTitle, breadcrumbItems } = useCampaignNavigation(
  route,
  campaignId,
  campaign,
  activeSessionTitle
)

provide('campaignAccess', access)
provide('campaignCanWriteContent', canWriteContent)

const sessionDateLabel = computed(() => {
  if (!sessionHeader.value?.playedAt) return 'Unscheduled'
  return new Date(sessionHeader.value.playedAt).toLocaleDateString()
})

const campaignHeaderHeadline = computed(() => 'Campaign')

const campaignHeaderDescription = computed(() => {
  const details = [
    campaign.value?.system || 'System not set',
    campaign.value?.dungeonMasterName ? `DM: ${campaign.value.dungeonMasterName}` : '',
  ].filter(Boolean)

  return details.join(' • ')
})

useSeoMeta({
  title: () => {
    const campaignName = campaign.value?.name || 'Campaign'
    return `${sectionTitle.value} | ${campaignName} | DM Vault`
  },
  description: () => {
    const campaignName = campaign.value?.name || 'campaign'
    return `Manage ${sectionTitle.value.toLowerCase()} for ${campaignName}.`
  },
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="pending" class="space-y-3">
      <UCard class="h-24 animate-pulse" />
      <UCard class="h-16 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load campaign shell.</p>
      <UButton class="mt-4" variant="outline" @click="refreshCampaign">Try again</UButton>
    </UCard>

    <UPage v-else-if="campaign" :ui="{ left: 'hidden lg:block lg:col-span-2 lg:self-start', center: 'lg:col-span-8' }">
      <template #left>
        <div class="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <UCard :ui="{ body: 'p-3 md:p-4' }">
            <p class="mb-2 text-xs uppercase tracking-[0.25em] text-dimmed">Campaign menu</p>
            <UNavigationMenu
              :items="navItems"
              orientation="vertical"
              class="data-[orientation=vertical]:w-full"
              :ui="{ linkLabel: 'whitespace-nowrap' }"
            />
          </UCard>
        </div>
      </template>

      <div class="space-y-4">
        <UPageHeader
          :headline="campaignHeaderHeadline"
          :title="campaign.name"
          :description="campaignHeaderDescription"
        >
          <template #default>
            <UBreadcrumb :items="breadcrumbItems" />
          </template>
        </UPageHeader>

        <SessionHeaderCard
          v-if="isSessionDetailRoute && sessionHeader"
          :session-number="sessionHeader.sessionNumber"
          :title="sessionHeader.title"
          :session-date-label="sessionDateLabel"
          :show-edit="false"
          :sticky="false"
        />

        <UCard class="lg:hidden" :ui="{ body: 'p-3 md:p-4' }">
          <UNavigationMenu
            :items="navItems"
            orientation="vertical"
            class="data-[orientation=vertical]:w-full"
            :ui="{ linkLabel: 'whitespace-nowrap' }"
          />
        </UCard>

        <NuxtPage />
      </div>
    </UPage>
  </div>
</template>
