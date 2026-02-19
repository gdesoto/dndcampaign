type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'

export const useCampaignStatusBadges = () => {
  const questStatusColor = (status: QuestStatus) => {
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

  const milestoneStatusColor = (isComplete: boolean) => (isComplete ? 'success' : 'secondary')

  return {
    questStatusColor,
    milestoneStatusColor,
  }
}
