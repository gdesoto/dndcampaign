<script setup lang="ts">
defineProps<{ label: string; score?: number | null; modifier?: string | null; compact?: boolean }>()
</script>

<template>
  <div class="sheet-compartment flex min-w-0 flex-col items-center p-3 text-center">
    <p class="type-label">{{ label }}</p>
    <p class="my-1 font-display font-semibold tabular-nums text-highlighted" :class="compact ? 'text-xl' : 'type-metric'">{{ score ?? '—' }}</p>
    <p class="min-w-10 rounded border border-muted px-2 py-0.5 text-sm font-semibold tabular-nums text-default">
      <span class="sr-only">Modifier </span>{{ modifier ?? '—' }}
    </p>
  </div>
</template>
