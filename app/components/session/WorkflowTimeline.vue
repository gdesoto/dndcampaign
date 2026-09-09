<script setup lang="ts">
import type { TimelineItem } from '@nuxt/ui'

const props = defineProps<{
  activeStep: string
  items: TimelineItem[]
}>()

const route = useRoute()
const links = computed(() => props.items.map(item => ({ label: item.title, icon: item.icon, to: `/campaigns/${route.params.campaignId}/sessions/${route.params.sessionId}${item.value === 'overview' ? '' : '/' + item.value}`, exact: item.value === 'overview' })))

</script>

<template>
  <nav aria-label="Session sections" class="overflow-x-auto">
    <UNavigationMenu :items="links" highlight class="min-w-max" />
  </nav>
</template>
