import type { DungeonCreateInput, DungeonImportInput, DungeonListQueryInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonDetail, CampaignDungeonSummary } from '#shared/types/dungeon'

export function useDungeonList() {
  const { request } = useApi()

  const listDungeons = async (campaignId: string, query: DungeonListQueryInput = {}) =>
    request<CampaignDungeonSummary[]>(`/api/campaigns/${campaignId}/dungeons`, {
      query,
    })

  const createDungeon = async (campaignId: string, input: DungeonCreateInput) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons`, {
      method: 'POST',
      body: input,
    })

  const importDungeon = async (campaignId: string, input: DungeonImportInput) =>
    request<{ id: string }>(`/api/campaigns/${campaignId}/dungeons/import`, {
      method: 'POST',
      body: input,
    })

  return {
    listDungeons,
    createDungeon,
    importDungeon,
  }
}
