import type {
  CampaignJournalArchiveInput,
  CampaignJournalCreateInput,
  CampaignJournalDiscoverInput,
  CampaignJournalDiscoverableUpdateInput,
  CampaignJournalHistoryListQueryInput,
  CampaignJournalListQueryInput,
  CampaignJournalNotificationListQueryInput,
  CampaignJournalTagListQueryInput,
  CampaignJournalTagSuggestQueryInput,
  CampaignJournalTransferInput,
  CampaignJournalUpdateInput,
} from '#shared/schemas/campaign-journal'
import { campaignJournalListMaxPageSize } from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalEntryDetail,
  CampaignJournalHistoryResponse,
  CampaignJournalListResponse,
  CampaignJournalNotificationListResponse,
  CampaignJournalTagListResponse,
  CampaignJournalMemberOption,
  CampaignJournalTagSuggestion,
} from '#shared/types/campaign-journal'

export function useCampaignJournal() {
  const { request } = useApi()

  const listEntries = async (
    campaignId: string,
    query: Partial<CampaignJournalListQueryInput> = {}
  ) =>
    request<CampaignJournalListResponse>(`/api/campaigns/${campaignId}/journal-entries`, {
      query,
    })

  const getEntry = async (campaignId: string, entryId: string) =>
    request<CampaignJournalEntryDetail>(`/api/campaigns/${campaignId}/journal-entries/${entryId}`)

  const createEntry = async (campaignId: string, payload: CampaignJournalCreateInput) =>
    request<CampaignJournalEntryDetail>(`/api/campaigns/${campaignId}/journal-entries`, {
      method: 'POST',
      body: payload,
    })

  const updateEntry = async (
    campaignId: string,
    entryId: string,
    payload: CampaignJournalUpdateInput
  ) =>
    request<CampaignJournalEntryDetail>(`/api/campaigns/${campaignId}/journal-entries/${entryId}`, {
      method: 'PATCH',
      body: payload,
    })

  const deleteEntry = async (campaignId: string, entryId: string) =>
    request<{ id: string }>(`/api/campaigns/${campaignId}/journal-entries/${entryId}`, {
      method: 'DELETE',
    })

  const updateDiscoverable = async (
    campaignId: string,
    entryId: string,
    payload: CampaignJournalDiscoverableUpdateInput
  ) =>
    request<CampaignJournalEntryDetail>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/discoverable`,
      {
        method: 'PATCH',
        body: payload,
      }
    )

  const discoverEntry = async (
    campaignId: string,
    entryId: string,
    payload: CampaignJournalDiscoverInput
  ) =>
    request<CampaignJournalEntryDetail>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/discover`,
      {
        method: 'POST',
        body: payload,
      }
    )

  const transferEntry = async (
    campaignId: string,
    entryId: string,
    payload: CampaignJournalTransferInput
  ) =>
    request<CampaignJournalEntryDetail>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/transfer`,
      {
        method: 'POST',
        body: payload,
      }
    )

  const archiveEntry = async (
    campaignId: string,
    entryId: string,
    payload: CampaignJournalArchiveInput = { archived: true }
  ) =>
    request<CampaignJournalEntryDetail>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/archive`,
      {
        method: 'POST',
        body: payload,
      }
    )

  const unarchiveEntry = async (campaignId: string, entryId: string) =>
    request<CampaignJournalEntryDetail>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/unarchive`,
      {
        method: 'POST',
      }
    )

  const listEntryHistory = async (
    campaignId: string,
    entryId: string,
    query: Partial<CampaignJournalHistoryListQueryInput> = {}
  ) =>
    request<CampaignJournalHistoryResponse>(
      `/api/campaigns/${campaignId}/journal-entries/${entryId}/history`,
      {
        query,
      }
    )

  const listNotifications = async (
    campaignId: string,
    query: Partial<CampaignJournalNotificationListQueryInput> = {}
  ) =>
    request<CampaignJournalNotificationListResponse>(`/api/campaigns/${campaignId}/journal-notifications`, {
      query,
    })

  const listMemberOptions = async (campaignId: string) =>
    request<{ items: CampaignJournalMemberOption[] }>(
      `/api/campaigns/${campaignId}/journal-member-options`,
    )

  const listTags = async (
    campaignId: string,
    query: Partial<CampaignJournalTagListQueryInput> = {}
  ) =>
    request<CampaignJournalTagListResponse>(`/api/campaigns/${campaignId}/journal-tags`, {
      query: {
        ...query,
        ...(query.pageSize !== undefined
          ? { pageSize: Math.min(query.pageSize, campaignJournalListMaxPageSize) }
          : {}),
      },
    })

  const suggestTags = async (
    campaignId: string,
    query: Partial<CampaignJournalTagSuggestQueryInput> = {}
  ) =>
    request<{ items: CampaignJournalTagSuggestion[] }>(
      `/api/campaigns/${campaignId}/journal-tags/suggest`,
      {
        query,
      }
    )

  return {
    listEntries,
    getEntry,
    createEntry,
    updateEntry,
    deleteEntry,
    updateDiscoverable,
    discoverEntry,
    transferEntry,
    archiveEntry,
    unarchiveEntry,
    listEntryHistory,
    listNotifications,
    listMemberOptions,
    listTags,
    suggestTags,
  }
}
