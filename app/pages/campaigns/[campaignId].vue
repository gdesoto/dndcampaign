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
  <div class="space-y-6">
    <div v-if="pending && !campaign" class="space-y-3">
      <UCard class="h-24 animate-pulse" />
      <UCard class="h-16 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load campaign shell.</p>
      <UButton class="mt-4" variant="outline" @click="refreshCampaign">Try again</UButton>
    </UCard>

    <div v-else-if="campaign" class="space-y-4">
      <NuxtPage />
    </div>
  </div>
</template>
