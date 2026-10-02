<script setup lang="ts">
type ActivityItem = {
  id: string
  date: string
  title: string
  description: string
}

const props = defineProps<{
  campaignId: string
  items: ActivityItem[]
}>()

const timelineItems = computed(() => props.items.map(item => ({
  date: item.date,
  title: item.description,
  icon: 'i-lucide-history',
})))
</script>

<template>
  <UCard variant="soft">
    <template #header>
      <h2 class="type-section">Recent activity</h2>
    </template>
    <UTimeline
      v-if="items.length"
      :items="timelineItems"
      size="sm"
      :ui="{ wrapper: 'min-w-0 pb-4 group-last:pb-0', title: 'font-normal break-words', date: 'mb-1' }"
    >
      <template #date="{ item }">
        <time :datetime="item.date" class="tabular-nums">{{ new Date(item.date).toLocaleString() }}</time>
      </template>
    </UTimeline>
    <p v-else class="text-sm text-muted">No recent activity yet.</p>
  </UCard>
</template>
