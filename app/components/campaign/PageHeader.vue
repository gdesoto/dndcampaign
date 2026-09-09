<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  count?: number
}>()
</script>

<template>
  <UPageHeader :title="title" :description="description">
    <template #title>
      <span class="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span class="min-w-0 break-words">{{ title }}</span>
        <span v-if="count !== undefined" class="text-sm font-normal tabular-nums text-muted" :aria-label="`${count} ${count === 1 ? 'result' : 'results'}`">{{ count }}</span>
      </span>
    </template>
    <template v-if="$slots.actions" #links>
      <div class="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
        <slot name="actions" />
      </div>
    </template>
  </UPageHeader>
</template>
