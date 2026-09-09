<script setup lang="ts">
const { publicSlug, publicCampaign, overview } = await usePublicCampaignPageContext()
const { data: recaps, pending, error, refresh } = await useAsyncData(
  () => `public-campaign-recaps-${publicSlug.value}`,
  () => publicCampaign.getRecaps(publicSlug.value),
)
const resolvePlayback = (id: string) => publicCampaign.getRecapPlaybackUrl(publicSlug.value, id)
useSeoMeta({ title: () => `Recap playlist | ${overview.value?.campaign.name || 'DM Vault'}` })
</script>

<template>
  <div class="py-6">
    <UPage>
      <section><h2 class=" type-section">Recap playlist</h2>
        <div><UButton :to="`/public/${publicSlug}/recaps`" variant="outline" icon="i-lucide-arrow-left">All recaps</UButton></div>
      </section>
      <div class="py-6">
        <UCard v-if="pending" class="h-64 animate-pulse" aria-label="Loading recaps" />
        <UCard v-else-if="error">
          <p role="alert" class="text-sm text-error">This public playlist is unavailable. It may no longer be shared.</p>
          <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
        </UCard>
        <CampaignRecapWatch v-else :key="publicSlug" :recaps="recaps" :base-path="`/public/${publicSlug}`" :resolve-playback="resolvePlayback" />
      </div>
    </UPage>
  </div>
</template>
