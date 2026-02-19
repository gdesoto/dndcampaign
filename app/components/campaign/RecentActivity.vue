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
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">Recent activity</h2>
          <p class="text-sm text-muted">Latest changes across the campaign.</p>
        </div>
        <UButton variant="outline" :to="`/campaigns/${campaignId}/sessions`">View sessions</UButton>
      </div>
    </template>
    <div v-if="items.length" class="space-y-4">
      <UTimeline :items="items">
        <template #date="{ item }">
          <span class="text-xs text-muted">{{ new Date(item.date).toLocaleString() }}</span>
        </template>
        <template #title="{ item }">
          <span class="text-sm font-semibold">{{ item.title }}</span>
        </template>
        <template #description="{ item }">
          <span class="text-xs text-muted">{{ item.description }}</span>
        </template>
      </UTimeline>
    </div>
    <p v-else class="text-sm text-muted">No recent activity yet.</p>
  </UCard>
</template>
