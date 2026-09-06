<script setup lang="ts">
import type { CampaignRecapItem } from '#shared/types/campaign-overview'

const { campaignId, request } = useCampaignPageContext()
const { data: recaps, pending, error, refresh } = await useAsyncData(
  () => `campaign-recaps-${campaignId.value}`,
  () => request<CampaignRecapItem[]>(`/api/campaigns/${campaignId.value}/recaps`),
)
const resolvePlayback = (id: string) => request<{ url: string }>(`/api/recaps/${id}/playback/url`)
</script>

<template>
  <UPage>
    <UPageHeader title="Recap playlist" description="Watch or listen through your campaign, one session at a time.">
      <template #links><UButton :to="`/campaigns/${campaignId}`" variant="outline" icon="i-lucide-arrow-left">Campaign overview</UButton></template>
    </UPageHeader>
    <div class="py-6">
      <UCard v-if="pending" class="h-64 animate-pulse" aria-label="Loading recaps" />
      <UCard v-else-if="error">
        <p role="alert" class="text-sm text-error">Unable to load this playlist.</p>
        <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
      </UCard>
      <CampaignRecapWatch v-else :key="campaignId" :recaps="recaps" :base-path="`/campaigns/${campaignId}`" :resolve-playback="resolvePlayback" />
    </div>
  </UPage>
</template>
