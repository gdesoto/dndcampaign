export type CampaignRequestType = 'ITEM' | 'PLOT_POINT'
export type CampaignRequestVisibility = 'PRIVATE' | 'PUBLIC'
export type CampaignRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELED'

export type CampaignRequestDecision = 'APPROVED' | 'DENIED'

export type CampaignRequestVoteSummary = {
  voteCount: number
  viewerHasVoted: boolean
}

export type CampaignRequestCapabilities = {
  canModerate: boolean
  canEdit: boolean
  canCancel: boolean
  canVote: boolean
}

export type CampaignRequestActorSummary = {
  userId: string
  name: string
}

export type CampaignRequestListItem = CampaignRequestVoteSummary
  & CampaignRequestCapabilities
  & {
    id: string
    campaignId: string
    createdByUserId: string
    createdByName: string
    type: CampaignRequestType
    visibility: CampaignRequestVisibility
    title: string
    description: string
    status: CampaignRequestStatus
    decisionNote: string | null
    decidedByUserId: string | null
    decidedByName: string | null
    decidedAt: string | null
    createdAt: string
    updatedAt: string
  }

export type CampaignRequestDetail = CampaignRequestListItem & {
  createdBy: CampaignRequestActorSummary
  decidedBy: CampaignRequestActorSummary | null
}

export type CampaignRequestListPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CampaignRequestListResponse = {
  items: CampaignRequestListItem[]
  pagination: CampaignRequestListPagination
}
