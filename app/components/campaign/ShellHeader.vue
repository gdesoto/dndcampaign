<script setup lang="ts">
defineProps<{
  name: string
  system?: string | null
  dungeonMasterName?: string | null
  sectionTitle: string
}>()
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Campaign</p>
        <h1 class="mt-1 text-2xl font-semibold">{{ name }}</h1>
        <p class="text-sm text-muted">
          <span>{{ system || 'System not set' }}</span>
          <span v-if="dungeonMasterName" class="mx-2">•</span>
          <span v-if="dungeonMasterName">DM: {{ dungeonMasterName }}</span>
        </p>
      </div>
      <UBadge variant="soft" color="secondary" size="sm">{{ sectionTitle }}</UBadge>
    </div>
  </UCard>
</template>
