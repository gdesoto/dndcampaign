import { computed, type Ref } from 'vue'
import type {
  CampaignMilestoneSummary,
  CampaignQuestSummary,
  CampaignSessionSummary,
} from '#shared/types/campaign-overview'

export const useCampaignOverviewMetrics = (
  sessions: Ref<CampaignSessionSummary[] | null | undefined>,
  quests: Ref<CampaignQuestSummary[] | null | undefined>,
  milestones: Ref<CampaignMilestoneSummary[] | null | undefined>
) => {
  const { questStatusColor } = useCampaignStatusBadges()

  const sortByDate = <T extends { createdAt?: string | null }>(
    items: T[],
    getDate: (item: T) => string | null | undefined
  ) =>
    [...items].sort(
      (a, b) =>
        new Date(getDate(b) || b.createdAt || 0).getTime()
        - new Date(getDate(a) || a.createdAt || 0).getTime()
    )

  const latestSession = computed(() => {
    const list = sessions.value || []
    return list.reduce<CampaignSessionSummary | null>((latest, current) => {
      const currentDate = new Date(current.playedAt || current.createdAt).getTime()
      const latestDate = latest ? new Date(latest.playedAt || latest.createdAt).getTime() : 0
      return currentDate > latestDate ? current : latest
    }, null)
  })

  const activeQuestCount = computed(
    () => (quests.value || []).filter((quest) => quest.status === 'ACTIVE').length
  )

  const openMilestoneCount = computed(
    () => (milestones.value || []).filter((milestone) => !milestone.isComplete).length
  )

  const recentSessions = computed(() =>
    sortByDate(sessions.value || [], (session) => session.playedAt).slice(0, 5)
  )

  const recentQuests = computed(() =>
    sortByDate(quests.value || [], (quest) => quest.updatedAt || quest.createdAt).slice(0, 5)
  )

  const recentMilestones = computed(() =>
    sortByDate(milestones.value || [], (milestone) => milestone.completedAt || milestone.createdAt).slice(0, 5)
  )

  return {
    latestSession,
    activeQuestCount,
    openMilestoneCount,
    recentSessions,
    recentQuests,
    recentMilestones,
    questStatusColor,
  }
}
