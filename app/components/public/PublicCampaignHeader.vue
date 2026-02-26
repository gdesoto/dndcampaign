<script setup lang="ts">
type PublicOverview = {
  campaign: {
    name: string
    system: string
    description: string | null
    dungeonMasterName: string | null
  }
  sections: {
    showCharacters: boolean
    showRecaps: boolean
    showSessions: boolean
    showGlossary: boolean
    showQuests: boolean
    showMilestones: boolean
    showMaps: boolean
    showJournal: boolean
  }
}

const props = defineProps<{
  publicSlug: string
  overview: PublicOverview
}>()

const route = useRoute()

const sectionLinks = computed(() => {
  const base = `/public/${props.publicSlug}`
  const sections = [
    { key: 'showCharacters', label: 'Characters', to: `${base}/characters` },
    { key: 'showRecaps', label: 'Recaps', to: `${base}/recaps` },
    { key: 'showSessions', label: 'Sessions', to: `${base}/sessions` },
    { key: 'showGlossary', label: 'Glossary', to: `${base}/glossary` },
    { key: 'showQuests', label: 'Quests', to: `${base}/quests` },
    { key: 'showMilestones', label: 'Milestones', to: `${base}/milestones` },
    { key: 'showMaps', label: 'Maps', to: `${base}/maps` },
    { key: 'showJournal', label: 'Journal', to: `${base}/journal` },
  ] as const

  return sections.filter((section) => props.overview.sections[section.key]).map((section) => ({
    ...section,
    active: route.path === section.to,
  }))
})
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Public Campaign</p>
        <h1 class="text-2xl font-semibold">{{ overview.campaign.name }}</h1>
        <p class="text-sm text-muted">
          {{ overview.campaign.system }}
          <template v-if="overview.campaign.dungeonMasterName">
            · DM: {{ overview.campaign.dungeonMasterName }}
          </template>
        </p>
        <p v-if="overview.campaign.description" class="text-sm text-muted">
          {{ overview.campaign.description }}
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="link in sectionLinks"
          :key="link.to"
          :to="link.to"
          size="xs"
          :variant="link.active ? 'solid' : 'outline'"
        >
          {{ link.label }}
        </UButton>
      </div>
    </div>
  </UCard>
</template>
