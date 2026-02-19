<script setup lang="ts">
const props = withDefaults(defineProps<{
  pending: boolean
  error?: unknown | null
  empty?: boolean
  errorMessage?: string
  emptyMessage?: string
}>(), {
  error: null,
  empty: false,
  errorMessage: 'Unable to load data.',
  emptyMessage: 'No results yet.',
})

const emit = defineEmits<{
  retry: []
}>()

const hasError = computed(() => Boolean(props.error))
</script>

<template>
  <div v-if="pending">
    <slot name="loading">
      <div class="grid gap-4 sm:grid-cols-2">
        <UCard v-for="i in 3" :key="i" class="h-28 animate-pulse" />
      </div>
    </slot>
  </div>

  <UCard v-else-if="hasError" class="text-center">
    <p class="text-sm text-error">{{ errorMessage }}</p>
    <div class="mt-4">
      <slot name="errorActions">
        <UButton variant="outline" @click="emit('retry')">Try again</UButton>
      </slot>
    </div>
  </UCard>

  <UCard v-else-if="empty" class="text-center">
    <p class="text-sm text-muted">{{ emptyMessage }}</p>
    <div class="mt-4">
      <slot name="emptyActions" />
    </div>
  </UCard>

  <slot v-else />
</template>
