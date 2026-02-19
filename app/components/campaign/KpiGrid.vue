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
    />
    <SharedStatCard
      label="Active quests"
      :value="activeQuestCount"
      :hint="activeQuestCount ? 'Keep them moving.' : 'Ready for a new thread.'"
    />
    <SharedStatCard
      label="Open milestones"
      :value="openMilestoneCount"
      :hint="openMilestoneCount ? 'Progress is steady.' : 'Milestones are clear.'"
    />
    <SharedStatCard
      label="Recaps"
      :value="recapCount"
      :hint="recapCount ? 'Keep the story alive.' : 'Upload the first recap.'"
    />
  </div>
</template>
