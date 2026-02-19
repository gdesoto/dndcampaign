<script setup lang="ts">
defineProps<{
  sessionNumber?: number | null
  title?: string | null
  sessionDateLabel: string
  showEdit?: boolean
  sticky?: boolean
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <UCard :class="[sticky === false ? 'h-fit' : 'sticky top-24 z-10 h-fit']">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-xs uppercase tracking-[0.3em] text-dimmed">
            {{ sessionNumber ? `Session ${sessionNumber}` : 'Session' }}
          </p>
          <h1 class="text-2xl font-semibold">{{ title || 'Session' }}</h1>
          <p class="text-sm text-muted">Played at: {{ sessionDateLabel }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton v-if="showEdit !== false" variant="outline" @click="emit('edit')">Edit session</UButton>
        </div>
      </div>
    </template>
  </UCard>
</template>
