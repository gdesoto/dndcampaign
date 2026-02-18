import type { CampaignAccess } from '#shared/types/campaign-workflow'
export type RecordingKind = 'AUDIO' | 'VIDEO'

export type SessionDetail = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
  guestDungeonMasterName?: string | null
  campaign?: {
    dungeonMasterName?: string | null
  } | null
  notes?: string | null
}

export type SessionRecordingItem = {
  id: string
  kind: RecordingKind
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
  vttArtifactId?: string | null
}

export type SessionRecapRecording = {
  id: string
  filename: string
  mimeType: string
  byteSize: number
  createdAt: string
}

export type SessionDocumentVersion = {
  id: string
  content: string
  format: 'MARKDOWN' | 'PLAINTEXT'
  versionNumber: number
  source: string
  createdAt: string
}

export type SessionDocumentDetail = {
  id: string
  type: 'TRANSCRIPT' | 'SUMMARY' | 'NOTES'
  title: string
  currentVersionId?: string | null
  currentVersion?: SessionDocumentVersion | null
}

export type SessionSummaryJob = {
  id: string
  status: string
  mode: string
  kind: 'SUMMARY_GENERATION' | 'SUGGESTION_GENERATION'
  trackingId: string
  promptProfile?: string | null
  summaryDocumentId?: string | null
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown> | null
}

export type SessionSummarySuggestion = {
  id: string
  entityType: string
  action: string
  status: string
  match?: Record<string, unknown> | null
  payload: Record<string, unknown>
}

export type SessionSummaryJobListItem = {
  id: string
  status: string
  mode: string
  kind: 'SUMMARY_GENERATION' | 'SUGGESTION_GENERATION'
  trackingId: string
  summaryDocumentId?: string | null
  createdAt: string
  updatedAt: string
}

export type SessionSummaryJobResponse = {
  job: SessionSummaryJob | null
  latestSummaryJob: SessionSummaryJob | null
  latestSuggestionJob: SessionSummaryJob | null
  suggestions: SessionSummarySuggestion[]
  latestSummarySuggestions: SessionSummarySuggestion[]
  latestSuggestionSuggestions: SessionSummarySuggestion[]
  jobs: SessionSummaryJobListItem[]
}

export type SessionSummaryJobDetail = SessionSummaryJob & {
  suggestions: SessionSummarySuggestion[]
}

export type SessionWorkspace = {
  session: SessionDetail
  recordings: SessionRecordingItem[]
  recap: SessionRecapRecording | null
  transcriptDoc: SessionDocumentDetail | null
  summaryDoc: SessionDocumentDetail | null
  access: CampaignAccess
}
