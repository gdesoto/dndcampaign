export type CampaignJournalVisibility = 'MYSELF' | 'DM' | 'CAMPAIGN'
export type CampaignJournalTagType = 'CUSTOM' | 'GLOSSARY'

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
  title: string
  contentMarkdown: string
  visibility: CampaignJournalVisibility
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
