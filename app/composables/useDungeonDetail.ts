import type {
  DungeonLinkCreateInput,
  DungeonExportInput,
  DungeonMapPatchInput,
  DungeonGenerateInput,
  DungeonRegenerateInput,
  DungeonSnapshotCreateInput,
  DungeonRoomUpdateInput,
  DungeonUpdateInput,
} from '#shared/schemas/dungeon'
import type {
  CampaignDungeonDetail,
  CampaignDungeonLink,
  CampaignDungeonRoom,
  CampaignDungeonSnapshot,
  DungeonExportResult,
  DungeonMapData,
} from '#shared/types/dungeon'

export function useDungeonDetail() {
  const { request } = useApi()

  const getDungeon = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}`)

  const updateDungeon = async (campaignId: string, dungeonId: string, input: DungeonUpdateInput) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteDungeon = async (campaignId: string, dungeonId: string) =>
    request(`/api/campaigns/${campaignId}/dungeons/${dungeonId}`, {
      method: 'DELETE',
    })

  const generateDungeon = async (campaignId: string, dungeonId: string, input: DungeonGenerateInput = {}) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/generate`, {
      method: 'POST',
      body: input,
    })

  const regenerateDungeon = async (campaignId: string, dungeonId: string, input: DungeonRegenerateInput) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/regenerate`, {
      method: 'POST',
      body: input,
    })

  const patchMap = async (campaignId: string, dungeonId: string, input: DungeonMapPatchInput) =>
    request<DungeonMapData>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/map`, {
      method: 'PATCH',
      body: input,
    })

  const listRooms = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonRoom[]>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms`)

  const updateRoom = async (
    campaignId: string,
    dungeonId: string,
    roomId: string,
    input: DungeonRoomUpdateInput,
  ) =>
    request<CampaignDungeonRoom>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms/${roomId}`, {
      method: 'PATCH',
      body: input,
    })

  const listLinks = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonLink[]>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/links`)

  const createLink = async (campaignId: string, dungeonId: string, input: DungeonLinkCreateInput) =>
    request<CampaignDungeonLink>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/links`, {
      method: 'POST',
      body: input,
    })

  const deleteLink = async (campaignId: string, dungeonId: string, linkId: string) =>
    request(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/links/${linkId}`, {
      method: 'DELETE',
    })

  const listSnapshots = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonSnapshot[]>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots`)

  const createSnapshot = async (
    campaignId: string,
    dungeonId: string,
    input: DungeonSnapshotCreateInput = { snapshotType: 'MANUAL' },
  ) =>
    request<CampaignDungeonSnapshot>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots`, {
      method: 'POST',
      body: input,
    })

  const restoreSnapshot = async (campaignId: string, dungeonId: string, snapshotId: string) =>
    request(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    })

  const exportDungeon = async (campaignId: string, dungeonId: string, input: DungeonExportInput) =>
    request<DungeonExportResult>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/export`, {
      method: 'POST',
      body: input,
    })

  const publishDungeon = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/publish`, {
      method: 'POST',
    })

  const unpublishDungeon = async (campaignId: string, dungeonId: string) =>
    request<CampaignDungeonDetail>(`/api/campaigns/${campaignId}/dungeons/${dungeonId}/unpublish`, {
      method: 'POST',
    })

  const createEncounterFromRoom = async (campaignId: string, dungeonId: string, roomId: string) =>
    request<{ encounterId: string }>(
      `/api/campaigns/${campaignId}/dungeons/${dungeonId}/rooms/${roomId}/create-encounter`,
      {
        method: 'POST',
      },
    )

  return {
    getDungeon,
    updateDungeon,
    deleteDungeon,
    generateDungeon,
    regenerateDungeon,
    patchMap,
    listRooms,
    updateRoom,
    listLinks,
    createLink,
    deleteLink,
    listSnapshots,
    createSnapshot,
    restoreSnapshot,
    exportDungeon,
    publishDungeon,
    unpublishDungeon,
    createEncounterFromRoom,
  }
}
