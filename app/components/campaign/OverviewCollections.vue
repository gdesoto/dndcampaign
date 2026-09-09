<script setup lang="ts">
import type { CampaignSessionSummary, CampaignQuestSummary, CampaignMilestoneSummary } from '#shared/types/campaign-overview'
import { formatSessionDate } from '~/utils/session-date'
import SharedSummarySection from '~/components/shared/SummarySection.vue'
import CampaignProgressBadge from '~/components/campaign/ProgressBadge.vue'

type ResourceState = { pending: boolean; error: unknown; hasData: boolean }
defineProps<{
  campaignId: string
  sessions: CampaignSessionSummary[]
  quests: CampaignQuestSummary[]
  milestones: CampaignMilestoneSummary[]
  sessionsState: ResourceState
  questsState: ResourceState
  milestonesState: ResourceState
}>()
defineEmits<{ retrySessions: []; retryQuests: []; retryMilestones: [] }>()
</script>

<template>
  <div class="grid items-start gap-4 lg:grid-cols-3">
    <SharedSummarySection title="Recent sessions" :to="`/campaigns/${campaignId}/sessions`" v-bind="sessionsState" :empty="!sessions.length" empty-message="No sessions yet." @retry="$emit('retrySessions')">
      <ul class="divide-y divide-muted">
        <li v-for="session in sessions" :key="session.id" class="py-3 first:pt-0 last:pb-0">
          <NuxtLink :to="`/campaigns/${campaignId}/sessions/${session.id}`" class="type-record break-words hover:underline">{{ session.title }}</NuxtLink>
          <p class="mt-1 text-xs tabular-nums text-muted">Session {{ session.sessionNumber ?? '—' }} · {{ formatSessionDate(session.playedAt) }}</p>
        </li>
      </ul>
    </SharedSummarySection>
    <SharedSummarySection title="Active quests" :to="`/campaigns/${campaignId}/quests`" v-bind="questsState" :empty="!quests.length" empty-message="No active quests. View all to see completed or on-hold quests." @retry="$emit('retryQuests')">
      <ul class="divide-y divide-muted">
        <li v-for="quest in quests" :key="quest.id" class="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
          <p class="type-record min-w-0 break-words">{{ quest.title }}</p>
          <CampaignProgressBadge :status="quest.status" />
        </li>
      </ul>
    </SharedSummarySection>
    <SharedSummarySection title="Recent milestones" :to="`/campaigns/${campaignId}/milestones`" v-bind="milestonesState" :empty="!milestones.length" empty-message="No milestones yet." @retry="$emit('retryMilestones')">
      <ul class="divide-y divide-muted">
        <li v-for="milestone in milestones" :key="milestone.id" class="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
          <p class="type-record min-w-0 break-words">{{ milestone.title }}</p>
          <CampaignProgressBadge :status="milestone.isComplete ? 'COMPLETED' : 'IN_PROGRESS'" />
        </li>
      </ul>
    </SharedSummarySection>
  </div>
</template>
