<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div :aria-label="label" role="search" class="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
    <slot />
    <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-2 sm:col-span-2 lg:col-span-1">
      <slot name="actions" />
    </div>
  </div>
</template>
