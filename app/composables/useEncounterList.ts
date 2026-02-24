import type { EncounterListQueryInput, EncounterCreateInput } from '#shared/schemas/encounter'
import type { EncounterSummary } from '#shared/types/encounter'

export function useEncounterList() {
  const { request } = useApi()

  const listEncounters = async (campaignId: string, query: EncounterListQueryInput = {}) =>
    request<EncounterSummary[]>(`/api/campaigns/${campaignId}/encounters`, {
      query,
    })

  const createEncounter = async (campaignId: string, input: EncounterCreateInput) =>
    request<EncounterSummary>(`/api/campaigns/${campaignId}/encounters`, {
      method: 'POST',
      body: input,
    })

  return {
    listEncounters,
    createEncounter,
  }
}