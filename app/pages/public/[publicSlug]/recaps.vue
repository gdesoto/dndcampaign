<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: recaps,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-recaps-${publicSlug.value}`,
  () => publicCampaign.getRecaps(publicSlug.value)
)

const player = useMediaPlayer()
const selectedRecapId = ref('')
const recapPlaybackUrl = ref('')
const recapLoading = ref(false)
const recapError = ref('')

watch(
  () => recaps.value,
  (value) => {
    if (value?.length && !selectedRecapId.value) {
      selectedRecapId.value = value[0].id
    }
  },
  { immediate: true }
)

const playRecap = async (recapId: string) => {
  recapError.value = ''
  recapLoading.value = true
  try {
    const playback = await publicCampaign.getRecapPlaybackUrl(publicSlug.value, recapId)
    if (!playback?.url) {
      throw new Error('Unable to resolve recap playback URL.')
    }
    recapPlaybackUrl.value = playback.url
    selectedRecapId.value = recapId
    const recap = recaps.value?.find((item) => item.id === recapId)
    await player.playSource(
      {
        id: recapId,
        title: recap?.session.title || recap?.filename || 'Public recap',
        subtitle: recap ? `Session ${recap.session.sessionNumber ?? '-'}` : undefined,
        kind: 'AUDIO',
        src: playback.url,
      },
      { presentation: 'global' }
    )
  } catch (playbackError) {
    recapError.value =
      (playbackError as Error & { message?: string }).message || 'Unable to load recap playback.'
  } finally {
    recapLoading.value = false
  }
}
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <div v-if="pending" class="space-y-2">
          <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
        </div>

        <UCard v-else-if="error" class="space-y-3">
          <p class="text-sm text-error">Recaps are not available for this public campaign.</p>
          <UButton variant="outline" @click="refresh">Try again</UButton>
        </UCard>

        <CampaignRecapPlaylist
          v-else
          :recaps="recaps"
          :selected-recap-id="selectedRecapId"
          :playback-url="recapPlaybackUrl"
          :loading="recapLoading"
          :deleting="false"
          :error="recapError"
          :delete-error="''"
          :can-delete="false"
          title="Public recap playlist"
          description="Listen to campaign recaps in read-only mode."
          empty-message="No public recaps available."
          @play="playRecap"
          @open-player="() => player.openDrawer()"
        />
      </div>
    </UPage>
  </UMain>
</template>
