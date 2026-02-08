<script setup lang="ts">
const props = defineProps<{
  system: string
  dungeonMasterName?: string | null
  description?: string | null
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="space-y-2">
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">
          <span>{{ system }}</span>
          <span v-if="dungeonMasterName" class="mx-2 text-muted">•</span>
          <span v-if="dungeonMasterName">DM: {{ dungeonMasterName }}</span>
        </p>
        <p class="text-sm text-muted">
          {{ description || 'Add a short overview for the campaign.' }}
        </p>
      </div>
      <UButton size="lg" variant="subtle" @click="emit('edit')">Edit campaign</UButton>
    </div>
  </UCard>
</template>
