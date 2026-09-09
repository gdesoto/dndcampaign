<script setup lang="ts">
const props = defineProps<{ status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD' | 'IN_PROGRESS' }>()
const states = {
  ACTIVE: { label: 'Active', color: 'success' },
  COMPLETED: { label: 'Completed', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
  ON_HOLD: { label: 'On hold', color: 'warning' },
  IN_PROGRESS: { label: 'In progress', color: 'info' },
} as const
const state = computed(() => states[props.status])
</script>

<template>
  <UBadge :color="state.color" variant="soft" size="sm">{{ state.label }}</UBadge>
</template>
