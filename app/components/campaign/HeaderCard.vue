<script setup lang="ts">
defineProps<{
  system: string
  dungeonMasterName?: string | null
  description?: string | null
}>()
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 flex-1 space-y-3">
        <p class="font-display text-xs uppercase tracking-[0.3em] text-dimmed">
          <span>{{ system }}</span>
          <span v-if="dungeonMasterName" class="mx-2 text-muted">•</span>
          <span v-if="dungeonMasterName">DM: {{ dungeonMasterName }}</span>
        </p>
        <div class="h-px w-full bg-linear-to-r from-(--ui-border-accented)/40 via-(--ui-border-accented)/20 to-transparent" />
        <p class="text-sm text-muted leading-relaxed">
          {{ description || 'Add a short overview for the campaign.' }}
        </p>
      </div>
    </div>
  </UCard>
</template>
