<script setup lang="ts">
definePageMeta({ layout: 'default' })

type ToolTab = {
  value: 'dice-roller' | 'encounter-builder' | 'dungeon-map-generator'
  label: string
}

type ToolPlaceholder = {
  id: 'dungeon-map-generator'
  title: string
  description: string
  icon: string
}

const activeTab = ref<ToolTab['value']>('dice-roller')
const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)

const toolTabs: ToolTab[] = [
  { value: 'dice-roller', label: 'Dice Roller' },
  { value: 'encounter-builder', label: 'Encounter Builder' },
  { value: 'dungeon-map-generator', label: 'Dungeon Map Generator' },
]

const tools: ToolPlaceholder[] = [
  {
    id: 'dungeon-map-generator',
    title: 'Dungeon Map Generator',
    description: 'Placeholder for generating dungeon layouts and export options.',
    icon: 'i-lucide-map-plus',
  },
]

const activePlaceholder = computed(() =>
  tools.find((tool) => tool.id === activeTab.value) || null,
)
</script>

<template>
  <div class="space-y-8">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Tools</p>
      <h1 class="mt-2 text-2xl font-semibold">Campaign tools</h1>
      <p class="mt-3 max-w-3xl text-sm text-muted">
        Utilities for session prep and table management.
      </p>
    </div>

    <UCard>
      <UTabs v-model="activeTab" :items="toolTabs" :content="false" />
    </UCard>

    <CampaignToolsDiceRoller v-if="activeTab === 'dice-roller'" />
    <UCard v-else-if="activeTab === 'encounter-builder'" :ui="{ body: 'p-5' }">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-2">
          <h2 class="text-base font-semibold">Encounter Builder</h2>
          <p class="max-w-2xl text-sm text-muted">
            Encounter planning and live runtime tracking now live in the campaign Encounters section.
          </p>
        </div>
        <UButton :to="`/campaigns/${campaignId}/encounters`">Open Encounters</UButton>
      </div>
    </UCard>

    <UCard
      v-else-if="activePlaceholder"
      :ui="{ body: 'p-5' }"
    >
      <div class="flex items-start gap-3">
        <div class="rounded-md border border-default p-2 text-primary">
          <UIcon :name="activePlaceholder.icon" class="h-5 w-5" />
        </div>
        <div class="min-w-0 space-y-2">
          <h2 class="text-base font-semibold">{{ activePlaceholder.title }}</h2>
          <p class="text-sm text-muted">{{ activePlaceholder.description }}</p>
          <UBadge color="neutral" variant="subtle">Coming soon</UBadge>
        </div>
      </div>
    </UCard>

    <UCard v-else :ui="{ body: 'p-5' }">
      <div class="text-sm text-muted">Tool not found.</div>
    </UCard>
  </div>
</template>
