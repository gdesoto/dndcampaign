<script setup lang="ts">
const props = withDefaults(defineProps<{
  pending: boolean
  hasData?: boolean
  noMatches?: boolean
  error?: unknown | null
  empty?: boolean
  errorMessage?: string
  emptyMessage?: string
}>(), {
  error: undefined,
  empty: false,
  hasData: false,
  noMatches: false,
  errorMessage: 'Unable to load data.',
  emptyMessage: 'No results yet.',
})

const emit = defineEmits<{
  retry: []
  clear: []
}>()

const hasError = computed(() => Boolean(props.error))
</script>

<template>
  <div v-if="pending && !hasData" aria-busy="true" aria-label="Loading content">
    <slot name="loading">
      <div class="grid gap-4 sm:grid-cols-2">
        <UCard v-for="i in 3" :key="i" class="h-28 animate-pulse" />
      </div>
    </slot>
  </div>

  <UCard v-else-if="hasError && !hasData" class="text-center">
    <p class="text-sm text-error">{{ errorMessage }}</p>
    <div class="mt-4">
      <slot name="errorActions">
        <UButton variant="outline" @click="emit('retry')">Try again</UButton>
      </slot>
    </div>
  </UCard>

  <UCard v-else-if="empty && !pending && !hasError" class="text-center">
    <p class="text-sm text-muted">{{ noMatches ? 'No results match your filters.' : emptyMessage }}</p>
    <div class="mt-4">
      <UButton v-if="noMatches" color="neutral" variant="outline" @click="emit('clear')">Clear filters</UButton>
      <slot v-else name="emptyActions" />
    </div>
  </UCard>

  <div v-else :aria-busy="pending" class="space-y-3">
    <p v-if="pending" role="status" class="text-sm text-muted">Refreshing… Showing previous results.</p>
    <UAlert v-if="hasError" color="error" :description="errorMessage" :actions="[{ label: 'Retry', color: 'neutral', variant: 'outline', onClick: () => emit('retry') }]" />
    <slot />
  </div>
</template>
