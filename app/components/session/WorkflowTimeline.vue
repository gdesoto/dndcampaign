<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  items: NavigationMenuItem[]
}>()
</script>

<template>
  <nav aria-label="Session sections" class="min-w-0 rounded-lg border border-default bg-elevated/50 p-1">
    <UNavigationMenu :items="items" highlight :ui="{ list: 'flex-wrap' }" />
  </nav>
</template>
