<script setup lang="ts">
type ActivityItem = {
  id: string
  date: string
  title: string
  description: string
}

defineProps<{
  campaignId: string
  items: ActivityItem[]
}>()
</script>

<template>
  <UCard variant="soft">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class=" type-section">Recent activity</h2>
        </div>
      </div>
    </template>
    <UTimeline v-if="items.length" :items="items" size="xs">
      <template #indicator><UIcon name="i-lucide-history" class="size-3" aria-hidden="true" /></template>
      <template #wrapper="{ item }">
        <p class="text-sm text-default">{{ item.description }}</p>
        <time :datetime="item.date" class="mt-1 block text-xs tabular-nums text-muted">{{ new Date(item.date).toLocaleString() }}</time>
      </template>
    </UTimeline>
    <p v-else class="text-sm text-muted">No recent activity yet.</p>
  </UCard>
</template>
