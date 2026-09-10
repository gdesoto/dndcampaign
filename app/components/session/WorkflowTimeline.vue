<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'

const props = defineProps<{
  items: TimelineItem[]
}>()

const route = useRoute()
const links = computed(() => props.items.map(item => ({ label: item.title, icon: item.icon, to: `/campaigns/${route.params.campaignId}/sessions/${route.params.sessionId}${item.value === 'overview' ? '' : '/' + item.value}`, exact: item.value === 'overview' })))

</script>

<template>
  <nav aria-label="Session sections" class="min-w-0 rounded-lg border border-default bg-elevated/50 p-1">
    <UNavigationMenu :items="links" highlight :ui="{ list: 'flex-wrap', link: 'min-h-11' }" />
  </nav>
</template>
