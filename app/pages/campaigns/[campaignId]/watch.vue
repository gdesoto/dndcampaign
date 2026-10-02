<script setup lang="ts">
import type { CampaignRecapItem } from '#shared/types/campaign-overview'
import { artifactStreamUrl } from '~/utils/artifact'
definePageMeta({ layout: 'dashboard' })

const { campaignId, request } = useCampaignPageContext()
const { data: recaps, pending, error, refresh } = await useAsyncData(
  () => `campaign-recaps-${campaignId.value}`,
  () => request<CampaignRecapItem[]>(`/api/campaigns/${campaignId.value}/recaps`),
)
const resolvePlayback = (id: string) => {
  const recap = recaps.value?.find(item => item.id === id)
  return recap ? { url: artifactStreamUrl(recap.artifactId) } : null
}
</script>

<template>
  <div class="space-y-4">
    <CampaignPageHeader title="Recap playlist" :count="recaps?.length">
      <template #actions><UButton :to="`/campaigns/${campaignId}`" variant="outline" icon="i-lucide-arrow-left">Campaign overview</UButton></template>
    </CampaignPageHeader>
    <div class="py-6">
      <UCard v-if="pending" class="h-64 animate-pulse" aria-label="Loading recaps" />
      <UCard v-else-if="error">
        <p role="alert" class="text-sm text-error">Unable to load this playlist.</p>
        <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
      </UCard>
      <CampaignRecapWatch v-else :key="campaignId" :recaps="recaps" :base-path="`/campaigns/${campaignId}`" :resolve-playback="resolvePlayback" />
    </div>
  </div>
</template>
