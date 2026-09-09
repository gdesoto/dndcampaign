<script setup lang="ts">
defineProps<{
  lastSessionNumber: string | number
  lastSessionDateLabel: string
  activeQuestCount: number
  openMilestoneCount: number
  recapCount: number
}>()
</script>

<template>
  <div class="grid gap-4 md:grid-cols-4">
    <SharedStatCard
      label="Last session"
      :value="lastSessionNumber"
      :hint="lastSessionDateLabel"
      tone="neutral"
      icon="i-twemoji-spiral-calendar"
    />
    <SharedStatCard
      label="Active quests"
      :value="activeQuestCount"
      hint="Currently active"
      icon="i-twemoji-scroll"
    />
    <SharedStatCard
      label="Open milestones"
      :value="openMilestoneCount"
      hint="Not yet completed"
      icon="i-twemoji-triangular-flag"
    />
    <SharedStatCard
      label="Recaps"
      :value="recapCount"
      hint="Available to watch or listen"
      icon="i-twemoji-clapper-board"
    />
  </div>
</template>
