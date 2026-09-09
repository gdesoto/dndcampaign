<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

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

const { sectionTitle } = useCampaignNavigation(
  route,
  campaignId,
  campaign,
  activeSessionTitle,
)

provide('campaignAccess', access)
provide('campaignCanWriteContent', canWriteContent)

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
  <SharedResourceState
    :pending="pending"
    :error="error"
    :has-data="Boolean(campaign)"
    error-message="Unable to load campaign workspace."
    @retry="refreshCampaign"
  >
    <template #loading>
      <div class="space-y-3">
        <USkeleton class="h-24" />
        <USkeleton class="h-16" />
      </div>
    </template>
    <div v-if="campaign" class="min-w-0 space-y-4">
      <NuxtPage />
    </div>
  </SharedResourceState>
</template>
