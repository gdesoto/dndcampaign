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

const icons: Record<string, string> = { Characters: 'i-lucide-users', Recaps: 'i-lucide-play', Sessions: 'i-lucide-calendar', Glossary: 'i-lucide-book-open', Quests: 'i-lucide-scroll', Milestones: 'i-lucide-flag', Maps: 'i-lucide-map', Journal: 'i-lucide-notebook' }

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

  return [{ label: 'Overview', to: base, exact: true, icon: 'i-lucide-layout-dashboard' }, ...sections.filter((section) => props.overview.sections[section.key]).map((section) => ({
    ...section,
    icon: icons[section.label],
  }))]
})
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <div class="space-y-1">
        <p class="text-xs uppercase tracking-[0.08em] text-dimmed">Public Campaign</p>
        <h1 class=" type-title">{{ overview.campaign.name }}</h1>
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

<nav aria-label="Public campaign sections" class="overflow-x-auto"><UNavigationMenu :items="sectionLinks" highlight class="min-w-max" /></nav>
    </div>
  </UCard>
</template>
