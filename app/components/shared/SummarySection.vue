<script setup lang="ts">
defineProps<{
  title: string
  to: string
  pending?: boolean
  error?: unknown
  hasData: boolean
  empty: boolean
  emptyMessage: string
}>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="type-section min-w-0">{{ title }}</h2>
        <UTooltip :text="`View all ${title.toLowerCase()}`">
          <UButton :to="to" color="neutral" variant="ghost" size="sm" class="shrink-0" :aria-label="`View all ${title.toLowerCase()}`" icon="i-lucide-arrow-right" />
        </UTooltip>
      </div>
    </template>
    <SharedResourceState :pending="Boolean(pending)" :error="error" :has-data="hasData" :empty="empty" :empty-message="emptyMessage" :error-message="`Unable to load ${title.toLowerCase()}.`" @retry="$emit('retry')">
      <template #loading><USkeleton class="h-24" /></template>
      <slot />
    </SharedResourceState>
  </UCard>
</template>
