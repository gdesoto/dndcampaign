<script setup lang="ts">
const route = useRoute()
const publicSlug = computed(() => route.params.publicSlug as string)
const publicCampaign = usePublicCampaign()

const {
  data: overview,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `public-campaign-overview-${publicSlug.value}`,
  () => publicCampaign.getOverview(publicSlug.value)
)

const sections = computed(() => {
  if (!overview.value) return []

  const base = `/public/${publicSlug.value}`
  const all = [
    { key: 'showCharacters', label: 'Characters', to: `${base}/characters` },
    { key: 'showRecaps', label: 'Recaps', to: `${base}/recaps` },
    { key: 'showSessions', label: 'Sessions', to: `${base}/sessions` },
    { key: 'showGlossary', label: 'Glossary', to: `${base}/glossary` },
    { key: 'showQuests', label: 'Quests', to: `${base}/quests` },
    { key: 'showMilestones', label: 'Milestones', to: `${base}/milestones` },
    { key: 'showMaps', label: 'Maps', to: `${base}/maps` },
    { key: 'showJournal', label: 'Journal', to: `${base}/journal` },
  ] as const

  return all.filter((section) => overview.value?.sections[section.key])
})
</script>

<template>
  <UMain>
    <UPage>
      <div class="space-y-6">
        <div v-if="pending" class="space-y-3">
          <UCard class="h-24 animate-pulse" />
          <UCard class="h-32 animate-pulse" />
        </div>

        <UCard v-else-if="error">
          <p class="text-sm text-error">This public campaign is unavailable.</p>
          <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
        </UCard>

        <template v-else-if="overview">
          <PublicCampaignHeader :public-slug="publicSlug" :overview="overview" />

          <UAlert
            color="info"
            variant="subtle"
            title="Read-only view"
            description="This is a public campaign snapshot. Editing actions are disabled."
          />

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">Available sections</h2>
            </template>

            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="section in sections"
                :key="section.to"
                :to="section.to"
                variant="outline"
              >
                {{ section.label }}
              </UButton>
            </div>
          </UCard>
        </template>
      </div>
    </UPage>
  </UMain>
</template>

