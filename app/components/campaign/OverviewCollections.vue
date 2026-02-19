<script setup lang="ts">
type SessionSummary = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  createdAt: string
}

type QuestSummary = {
  id: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
}

type MilestoneSummary = {
  id: string
  title: string
  isComplete: boolean
}

type UiColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'

defineProps<{
  campaignId: string
  sessions: SessionSummary[]
  quests: QuestSummary[]
  milestones: MilestoneSummary[]
  questStatusColor: (status: QuestSummary['status']) => UiColor
}>()

const formatDate = (value?: string | null) => {
  if (!value) return 'Unscheduled'
  return new Date(value).toLocaleDateString()
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-3">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Recent sessions</h3>
          <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/sessions`">View all</UButton>
        </div>
      </template>
      <div v-if="sessions.length" class="space-y-3 text-sm">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
        >
          <div>
            <p class="font-semibold">{{ session.title }}</p>
            <p class="text-xs text-muted">
              Session {{ session.sessionNumber ?? '-' }} - {{ formatDate(session.playedAt || session.createdAt) }}
            </p>
          </div>
          <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/sessions/${session.id}`">Open</UButton>
        </div>
      </div>
      <p v-else class="text-sm text-muted">No sessions yet.</p>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Active quests</h3>
          <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/quests`">View all</UButton>
        </div>
      </template>
      <div v-if="quests.length" class="space-y-3 text-sm">
        <div
          v-for="quest in quests"
          :key="quest.id"
          class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
        >
          <div>
            <p class="font-semibold">{{ quest.title }}</p>
            <p class="text-xs text-muted">Status: {{ quest.status }}</p>
          </div>
          <UBadge :color="questStatusColor(quest.status)" variant="soft" size="sm">
            {{ quest.status }}
          </UBadge>
        </div>
      </div>
      <p v-else class="text-sm text-muted">No quests yet.</p>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold">Milestones</h3>
          <UButton size="xs" variant="outline" :to="`/campaigns/${campaignId}/milestones`">View all</UButton>
        </div>
      </template>
      <div v-if="milestones.length" class="space-y-3 text-sm">
        <div
          v-for="milestone in milestones"
          :key="milestone.id"
          class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/30 p-3"
        >
          <div>
            <p class="font-semibold">{{ milestone.title }}</p>
            <p class="text-xs text-muted">
              {{ milestone.isComplete ? 'Completed' : 'In progress' }}
            </p>
          </div>
          <UBadge :color="milestone.isComplete ? 'success' : 'secondary'" variant="soft" size="sm">
            {{ milestone.isComplete ? 'Done' : 'Open' }}
          </UBadge>
        </div>
      </div>
      <p v-else class="text-sm text-muted">No milestones yet.</p>
    </UCard>
  </div>
</template>
