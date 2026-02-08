import { computed, type Ref } from 'vue'

type OverviewSession = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  createdAt: string
}

type OverviewQuest = {
  id: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  updatedAt?: string | null
  createdAt?: string | null
}

type OverviewMilestone = {
  id: string
  title: string
  isComplete: boolean
  completedAt?: string | null
  createdAt?: string | null
}

export const useCampaignOverviewMetrics = (
  sessions: Ref<OverviewSession[] | null | undefined>,
  quests: Ref<OverviewQuest[] | null | undefined>,
  milestones: Ref<OverviewMilestone[] | null | undefined>
) => {
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
    return list.reduce<OverviewSession | null>((latest, current) => {
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

  const questStatusColor = (status: OverviewQuest['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'success'
      case 'FAILED':
        return 'error'
      case 'ON_HOLD':
        return 'warning'
      default:
        return 'secondary'
    }
  }

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
