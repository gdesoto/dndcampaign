<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: maps,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-maps-${publicSlug.value}`,
  () => publicCampaign.getMaps(publicSlug.value)
)

const selectedMapSlug = ref('')
const selectedFeatureIds = ref<string[]>([])

watch(
  () => maps.value,
  (value) => {
    if (value?.length && !selectedMapSlug.value) {
      selectedMapSlug.value = value.find((entry) => entry.isPrimary)?.slug || value[0]!.slug
    }
  },
  { immediate: true }
)

const {
  data: mapViewer,
  pending: viewerPending,
  error: viewerError,
  refresh: refreshViewer,
} = await useAsyncData(
  () => `public-campaign-map-viewer-${publicSlug.value}-${selectedMapSlug.value}`,
  async () => {
    if (!selectedMapSlug.value) return null
    return publicCampaign.getMapViewer(publicSlug.value, selectedMapSlug.value)
  },
  { watch: [selectedMapSlug] }
)

const activeLayers = ref<import('#shared/schemas/map').MapFeatureType[]>([
  'state',
  'province',
  'burg',
  'marker',
  'river',
  'route',
  'cell',
])

const updateSelectedFeatureIds = (value: string[]) => {
  selectedFeatureIds.value = value
}
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold">Maps</h2>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Maps are not available for this public campaign.</p>
            <UButton variant="outline" @click="() => refresh()">Try again</UButton>
          </div>

          <div v-else-if="!maps?.length" class="text-sm text-muted">No public maps available.</div>

          <div v-else class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <button
                v-for="map in maps"
                :key="map.slug"
                type="button"
                class="rounded-lg border border-default bg-elevated/20 p-3 text-left transition"
                :class="selectedMapSlug === map.slug ? 'border-primary/60 bg-primary/10' : ''"
                @click="selectedMapSlug = map.slug"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-sm font-semibold">{{ map.name }}</p>
                  <UBadge v-if="map.isPrimary" color="primary" variant="subtle">Primary</UBadge>
                  <UBadge color="neutral" variant="outline">{{ map.status }}</UBadge>
                </div>
                <p class="text-xs text-muted">Slug: {{ map.slug }}</p>
              </button>
            </div>

            <div v-if="viewerPending" class="h-96 animate-pulse rounded-lg bg-muted"></div>

            <UCard v-else-if="viewerError || !mapViewer" class="space-y-3">
              <p class="text-sm text-error">Unable to load the selected public map viewer.</p>
              <UButton variant="outline" @click="() => refreshViewer()">Try again</UButton>
            </UCard>

            <MapsViewer
              v-else
              :viewer="mapViewer"
              :svg-background-url="publicCampaign.getMapSvgUrl(publicSlug, selectedMapSlug)"
              :active-layers="activeLayers"
              :selected-feature-ids="selectedFeatureIds"
              @update:selected-feature-ids="updateSelectedFeatureIds"
            />
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>

