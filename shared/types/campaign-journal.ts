export type CampaignJournalVisibility = 'MYSELF' | 'DM' | 'CAMPAIGN'
export type CampaignJournalTagType = 'CUSTOM' | 'GLOSSARY'
export type CampaignJournalDiscoverableVisibility = 'DM' | 'CAMPAIGN'
export type CampaignJournalTransferHistoryAction =
  | 'DISCOVERED'
  | 'TRANSFERRED'
  | 'UNASSIGNED'
  | 'ARCHIVED'
  | 'UNARCHIVED'
export type CampaignJournalNotificationType = 'DISCOVERED' | 'TRANSFERRED' | 'ARCHIVED' | 'UNARCHIVED'

export type CampaignJournalEntryCapabilities = {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
}

export type CampaignJournalSessionLinkSummary = {
  sessionId: string
  title: string
  sessionNumber: number | null
}

export type CampaignJournalCustomTag = {
  id: string
  tagType: 'CUSTOM'
  displayLabel: string
  normalizedLabel: string
  glossaryEntryId: null
  glossaryEntryName: null
  isOrphanedGlossaryTag: false
}

export type CampaignJournalLinkedGlossaryTag = {
  id: string
  tagType: 'GLOSSARY'
  displayLabel: string
  normalizedLabel: string
  glossaryEntryId: string
  glossaryEntryName: string
  isOrphanedGlossaryTag: false
}

export type CampaignJournalOrphanedGlossaryTag = {
  id: string
  tagType: 'GLOSSARY'
  displayLabel: string
  normalizedLabel: string
  glossaryEntryId: null
  glossaryEntryName: null
  isOrphanedGlossaryTag: true
}

export type CampaignJournalTag =
  | CampaignJournalCustomTag
  | CampaignJournalLinkedGlossaryTag
  | CampaignJournalOrphanedGlossaryTag

export type CampaignJournalEntryListItem = CampaignJournalEntryCapabilities & {
  id: string
  campaignId: string
  authorUserId: string
  authorName: string
  holderUserId?: string | null
  holderUserName?: string | null
  title: string
  contentMarkdown: string
  visibility: CampaignJournalVisibility
  isDiscoverable?: boolean
  discoveredAt?: string | null
  discoveredByUserId?: string | null
  discoveredByUserName?: string | null
  isArchived?: boolean
  archivedAt?: string | null
  archivedByUserId?: string | null
  archivedByUserName?: string | null
  sessions: CampaignJournalSessionLinkSummary[]
  tags: CampaignJournalTag[]
  createdAt: string
  updatedAt: string
}

export type CampaignJournalEntryDetail = CampaignJournalEntryListItem

export type CampaignJournalListPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CampaignJournalListResponse = {
  items: CampaignJournalEntryListItem[]
  pagination: CampaignJournalListPagination
}

export type CampaignJournalTagListItem = {
  tagType: CampaignJournalTagType
  displayLabel: string
  normalizedLabel: string
  usageCount: number
  glossaryEntryId: string | null
  glossaryEntryName: string | null
  isOrphanedGlossaryTag: boolean
}

export type CampaignJournalTagListResponse = {
  items: CampaignJournalTagListItem[]
  pagination: CampaignJournalListPagination
}

export type CampaignJournalTagSuggestion = {
  tagType: CampaignJournalTagType
  displayLabel: string
  normalizedLabel: string
  glossaryEntryId: string | null
  glossaryEntryName: string | null
}

export type CampaignJournalTransferHistoryItem = {
  id: string
  campaignJournalEntryId: string
  campaignId: string
  fromHolderUserId: string | null
  fromHolderUserName: string | null
  toHolderUserId: string | null
  toHolderUserName: string | null
  actorUserId: string
  actorUserName: string
  action: CampaignJournalTransferHistoryAction
  createdAt: string
}

export type CampaignJournalHistoryResponse = {
  items: CampaignJournalTransferHistoryItem[]
  pagination: CampaignJournalListPagination
}

export type CampaignJournalNotificationItem = {
  id: string
  campaignId: string
  entryId: string
  type: CampaignJournalNotificationType
  title: string
  message: string
  actorUserId: string | null
  actorUserName: string | null
  createdAt: string
}

export type CampaignJournalNotificationListResponse = {
  items: CampaignJournalNotificationItem[]
  pagination: CampaignJournalListPagination
}

export type CampaignJournalMemberOption = {
  userId: string
  name: string
  role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
  hasDmAccess: boolean
}
