import type {
  CampaignJournalCreateInput,
  CampaignJournalListQueryInput,
  CampaignJournalTagListQueryInput,
  CampaignJournalTagSuggestQueryInput,
  CampaignJournalUpdateInput,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalEntryDetail,
  CampaignJournalListResponse,
  CampaignJournalTagListResponse,
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

  const listTags = async (
    campaignId: string,
    query: Partial<CampaignJournalTagListQueryInput> = {}
  ) =>
    request<CampaignJournalTagListResponse>(`/api/campaigns/${campaignId}/journal-tags`, {
      query,
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
    listTags,
    suggestTags,
  }
}
