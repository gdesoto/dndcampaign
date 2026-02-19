import { computed, type Ref } from 'vue'
import type {
  CampaignActivityItem,
  CampaignMilestoneSummary,
  CampaignQuestSummary,
  CampaignRecapItem,
  CampaignSessionSummary, CampaignOverviewDetail 
} from '#shared/types/campaign-overview'

export const useCampaignActivityItems = (
  campaign: Ref<CampaignOverviewDetail | null | undefined>,
  recaps: Ref<CampaignRecapItem[] | null | undefined>,
  sessions: Ref<CampaignSessionSummary[] | null | undefined>,
  quests: Ref<CampaignQuestSummary[] | null | undefined>,
  milestones: Ref<CampaignMilestoneSummary[] | null | undefined>
) => {
  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Unscheduled'
    return new Date(value).toLocaleString()
  }

  const activityItems = computed<CampaignActivityItem[]>(() => {
    const items: CampaignActivityItem[] = []

    if (campaign.value?.updatedAt) {
      items.push({
        id: `campaign-${campaign.value.id}`,
        date: campaign.value.updatedAt,
        title: 'Campaign updated',
        description: `Updated ${formatDateTime(campaign.value.updatedAt)}.`,
      })
    }

    for (const recap of recaps.value || []) {
      items.push({
        id: `recap-${recap.id}`,
        date: recap.createdAt,
        title: 'Recap uploaded',
        description: `${recap.session.title} - ${formatDateTime(recap.createdAt)}`,
      })
    }

    for (const session of sessions.value || []) {
      const date = session.playedAt || session.createdAt
      items.push({
        id: `session-${session.id}`,
        date,
        title: `Session ${session.sessionNumber ?? '-'}`,
        description: `${session.title} - ${formatDateTime(date)}`,
      })
    }

    for (const quest of quests.value || []) {
      const date = quest.updatedAt || quest.createdAt
      if (!date) continue
      items.push({
        id: `quest-${quest.id}`,
        date,
        title: 'Quest updated',
        description: `${quest.title} - ${formatDateTime(date)}`,
      })
    }

    for (const milestone of milestones.value || []) {
      const date = milestone.completedAt || milestone.createdAt
      if (!date) continue
      items.push({
        id: `milestone-${milestone.id}`,
        date,
        title: milestone.isComplete ? 'Milestone completed' : 'Milestone updated',
        description: `${milestone.title} - ${formatDateTime(date)}`,
      })
    }

    return items
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  })

  return {
    activityItems,
  }
}
