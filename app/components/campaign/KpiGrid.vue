<script setup lang="ts">
defineProps<{
  campaignId: string
  latestSessionId?: string
  lastSessionNumber: string | number
  lastSessionDateLabel: string
  activeQuestCount: number | string
  openMilestoneCount: number | string
  recapCount: number | string
}>()
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <SharedStatCard
      label="Last session"
      :to="`/campaigns/${campaignId}/sessions${latestSessionId ? '/' + latestSessionId : ''}`"
      :value="lastSessionNumber"
      :hint="lastSessionDateLabel"
      tone="neutral"
      icon="i-twemoji-spiral-calendar"
    />
    <SharedStatCard
      label="Active quests"
      :to="`/campaigns/${campaignId}/quests`"
      :value="activeQuestCount"
      hint="Currently active"
      icon="i-twemoji-scroll"
    />
    <SharedStatCard
      label="Open milestones"
      :to="`/campaigns/${campaignId}/milestones`"
      :value="openMilestoneCount"
      hint="Not yet completed"
      icon="i-twemoji-triangular-flag"
    />
    <SharedStatCard
      label="Recaps"
      :to="`/campaigns/${campaignId}/watch`"
      :value="recapCount"
      hint="Available to watch or listen"
      icon="i-twemoji-clapper-board"
    />
  </div>
</template>
