export type CampaignOverviewDetail = {
  id: string
  name: string
  system: string
  dungeonMasterName?: string | null
  description?: string | null
  currentStatus?: string | null
  createdAt: string
  updatedAt: string
}

export type CampaignSessionSummary = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  createdAt: string
}

export type CampaignQuestSummary = {
  id: string
  title: string
  type: 'MAIN' | 'SIDE' | 'PLAYER'
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  updatedAt?: string | null
  createdAt?: string | null
}

export type CampaignMilestoneSummary = {
  id: string
  title: string
  isComplete: boolean
  completedAt?: string | null
  createdAt?: string | null
}

export type CampaignRecapItem = {
  id: string
  filename: string
  createdAt: string
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  }
}

export type CampaignActivityItem = {
  id: string
  date: string
  title: string
  description: string
}

export type CampaignActivityLogItem = {
  id: string
  action: string
  summary?: string | null
  createdAt: string
}
