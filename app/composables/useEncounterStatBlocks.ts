import type { EncounterStatBlockCreateInput, EncounterStatBlockUpdateInput } from '#shared/schemas/encounter'
import type { EncounterStatBlock } from '#shared/types/encounter'

export function useEncounterStatBlocks() {
  const { request } = useApi()

  const listStatBlocks = async (campaignId: string) =>
    request<EncounterStatBlock[]>(`/api/campaigns/${campaignId}/encounter-stat-blocks`)

  const createStatBlock = async (campaignId: string, input: EncounterStatBlockCreateInput) =>
    request<EncounterStatBlock>(`/api/campaigns/${campaignId}/encounter-stat-blocks`, {
      method: 'POST',
      body: input,
    })

  const updateStatBlock = async (statBlockId: string, input: EncounterStatBlockUpdateInput) =>
    request<EncounterStatBlock>(`/api/encounter-stat-blocks/${statBlockId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteStatBlock = async (statBlockId: string) =>
    request(`/api/encounter-stat-blocks/${statBlockId}`, {
      method: 'DELETE',
    })

  return {
    listStatBlocks,
    createStatBlock,
    updateStatBlock,
    deleteStatBlock,
  }
}