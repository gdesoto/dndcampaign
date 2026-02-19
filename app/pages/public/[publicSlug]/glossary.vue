<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const { data: overview } = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const {
  data: glossary,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-glossary-${publicSlug.value}`,
  () => publicCampaign.getGlossary(publicSlug.value)
)

const glossaryFilter = ref<'ALL' | 'PC' | 'NPC' | 'ITEM' | 'LOCATION'>('ALL')

const glossaryFilterOptions = [
  { label: 'All', value: 'ALL' },
  { label: 'PC', value: 'PC' },
  { label: 'NPC', value: 'NPC' },
  { label: 'Item', value: 'ITEM' },
  { label: 'Location', value: 'LOCATION' },
]

const filteredGlossary = computed(() => {
  if (!glossary.value) return []
  if (glossaryFilter.value === 'ALL') return glossary.value
  return glossary.value.filter((entry) => entry.type === glossaryFilter.value)
})
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <PublicCampaignHeader v-if="overview" :public-slug="publicSlug" :overview="overview" />

        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-lg font-semibold">Glossary</h2>
              <USelect v-model="glossaryFilter" :items="glossaryFilterOptions" class="w-40" />
            </div>
          </template>

          <div v-if="pending" class="space-y-2">
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
            <div class="h-10 w-full animate-pulse rounded bg-muted"></div>
          </div>

          <div v-else-if="error" class="space-y-3">
            <p class="text-sm text-error">Glossary is not available for this public campaign.</p>
            <UButton variant="outline" @click="refresh">Try again</UButton>
          </div>

          <div v-else-if="!filteredGlossary.length" class="text-sm text-muted">No glossary entries match this type.</div>

          <div v-else class="space-y-3">
            <div
              v-for="entry in filteredGlossary"
              :key="`${entry.type}-${entry.name}`"
              class="rounded-lg border border-default bg-elevated/20 p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold">{{ entry.name }}</p>
                <UBadge variant="subtle">{{ entry.type }}</UBadge>
              </div>
              <p v-if="entry.aliases" class="text-xs text-muted">Aliases: {{ entry.aliases }}</p>
              <p class="mt-1 text-xs text-muted">{{ entry.description }}</p>
            </div>
          </div>
        </UCard>
      </div>
    </UPage>
  </UMain>
</template>
