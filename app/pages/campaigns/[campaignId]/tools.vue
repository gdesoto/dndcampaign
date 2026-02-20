<script setup lang="ts">
definePageMeta({ layout: 'default' })

type ToolPlaceholder = {
  id: 'encounter-builder' | 'dungeon-map-generator' | 'fantasy-calendar'
  title: string
  description: string
  icon: string
}

const tools: ToolPlaceholder[] = [
  {
    id: 'encounter-builder',
    title: 'Encounter Builder',
    description: 'Placeholder for encounter planning, balancing, and initiative setup.',
    icon: 'i-lucide-swords',
  },
  {
    id: 'dungeon-map-generator',
    title: 'Dungeon Map Generator',
    description: 'Placeholder for generating dungeon layouts and export options.',
    icon: 'i-lucide-map-plus',
  },
  {
    id: 'fantasy-calendar',
    title: 'Fantasy Calendar',
    description: 'Placeholder for in-world dates, events, and timeline tracking.',
    icon: 'i-lucide-calendar-cog',
  },
]
</script>

<template>
  <div class="space-y-8">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Tools</p>
      <h1 class="mt-2 text-2xl font-semibold">Campaign tools</h1>
      <p class="mt-3 max-w-3xl text-sm text-muted">
        Utilities for session prep and table management. These sections are placeholders for upcoming features.
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <CampaignToolsDiceRoller />
      <UCard
        v-for="tool in tools"
        :key="tool.id"
        :ui="{ body: 'p-5' }"
      >
        <div class="flex items-start gap-3">
          <div class="rounded-md border border-default p-2 text-primary">
            <UIcon :name="tool.icon" class="h-5 w-5" />
          </div>
          <div class="min-w-0 space-y-2">
            <h2 class="text-base font-semibold">{{ tool.title }}</h2>
            <p class="text-sm text-muted">{{ tool.description }}</p>
            <UBadge color="neutral" variant="subtle">Coming soon</UBadge>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
