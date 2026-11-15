import type {
  EncounterMapCreateInput,
  EncounterMapImportInput,
  EncounterMapLinkCreateInput,
  EncounterMapExportInput,
  EncounterMapPatchInput,
  EncounterMapRegenerateInput,
  EncounterMapSnapshotCreateInput,
  EncounterMapSnapshotUpdateInput,
  EncounterMapRoomUpdateInput,
  EncounterMapUpdateInput,
} from '#shared/schemas/encounter-map'
import type {
  CampaignEncounterMapDetail,
  CampaignEncounterMapSummary,
  CampaignEncounterMapLink,
  CampaignEncounterMapRegenerateResult,
  CampaignEncounterMapRoom,
  CampaignEncounterMapSnapshot,
  EncounterMapExportResult,
  EncounterMapData,
} from '#shared/types/encounter-map'

export function useEncounterMaps() {
  const { request } = useApi()

  const listEncounterMaps = async (campaignId: string) =>
    request<CampaignEncounterMapSummary[]>(`/api/campaigns/${campaignId}/encounter-maps`)

  const createEncounterMap = async (campaignId: string, input: EncounterMapCreateInput) =>
    request<CampaignEncounterMapDetail>(`/api/campaigns/${campaignId}/encounter-maps`, {
      method: 'POST',
      body: input,
    })

  const importEncounterMap = async (campaignId: string, input: EncounterMapImportInput) =>
    request<{ id: string }>(`/api/campaigns/${campaignId}/encounter-maps`, {
      method: 'POST',
      body: {
        action: 'import',
        ...input,
      },
    })

  const getEncounterMap = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapDetail>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`)

  const updateEncounterMap = async (campaignId: string, encounterMapId: string, input: EncounterMapUpdateInput) =>
    request<CampaignEncounterMapDetail>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteEncounterMap = async (campaignId: string, encounterMapId: string) =>
    request(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'DELETE',
    })

  const regenerateEncounterMap = async (campaignId: string, encounterMapId: string, input: EncounterMapRegenerateInput) =>
    request<CampaignEncounterMapRegenerateResult>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'PATCH',
      body: {
        action: 'regenerate',
        ...input,
      },
    })

  const patchMap = async (campaignId: string, encounterMapId: string, input: EncounterMapPatchInput) =>
    request<EncounterMapData>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/map`, {
      method: 'PATCH',
      body: input,
    })

  const listRooms = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapRoom[]>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/rooms`)

  const updateRoom = async (
    campaignId: string,
    encounterMapId: string,
    roomId: string,
    input: EncounterMapRoomUpdateInput,
  ) =>
    request<CampaignEncounterMapRoom>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/rooms/${roomId}`, {
      method: 'PATCH',
      body: input,
    })

  const listLinks = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapLink[]>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/links`)

  const createLink = async (campaignId: string, encounterMapId: string, input: EncounterMapLinkCreateInput) =>
    request<CampaignEncounterMapLink>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/links`, {
      method: 'POST',
      body: input,
    })

  const deleteLink = async (campaignId: string, encounterMapId: string, linkId: string) =>
    request(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/links/${linkId}`, {
      method: 'DELETE',
    })

  const listSnapshots = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapSnapshot[]>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/snapshots`, {
      query: { include: 'map' },
    })

  const createSnapshot = async (
    campaignId: string,
    encounterMapId: string,
    input: EncounterMapSnapshotCreateInput = { snapshotType: 'MANUAL' },
  ) =>
    request<CampaignEncounterMapSnapshot>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/snapshots`, {
      method: 'POST',
      body: input,
    })

  const updateSnapshot = async (campaignId: string, encounterMapId: string, snapshotId: string, input: EncounterMapSnapshotUpdateInput) =>
    request<CampaignEncounterMapSnapshot>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/snapshots/${snapshotId}`, {
      method: 'PATCH',
      body: input,
    })

  const restoreSnapshot = async (campaignId: string, encounterMapId: string, snapshotId: string) =>
    request<{ restored: true; roomsReset: boolean }>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    })

  const exportEncounterMap = async (campaignId: string, encounterMapId: string, input: EncounterMapExportInput) =>
    request<EncounterMapExportResult>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'PATCH',
      body: {
        action: 'export',
        ...input,
      },
    })

  const publishEncounterMap = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapDetail>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'PATCH',
      body: { action: 'publish' },
    })

  const unpublishEncounterMap = async (campaignId: string, encounterMapId: string) =>
    request<CampaignEncounterMapDetail>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}`, {
      method: 'PATCH',
      body: { action: 'unpublish' },
    })

  const createEncounterFromRoom = async (campaignId: string, encounterMapId: string, roomId: string) =>
    request<{ encounterId: string }>(`/api/campaigns/${campaignId}/encounter-maps/${encounterMapId}/rooms/${roomId}`, {
      method: 'PATCH',
      body: { action: 'create-encounter' },
    })

  return {
    listEncounterMaps,
    createEncounterMap,
    importEncounterMap,
    getEncounterMap,
    updateEncounterMap,
    deleteEncounterMap,
    regenerateEncounterMap,
    patchMap,
    listRooms,
    updateRoom,
    listLinks,
    createLink,
    deleteLink,
    listSnapshots,
    createSnapshot,
    updateSnapshot,
    restoreSnapshot,
    exportEncounterMap,
    publishEncounterMap,
    unpublishEncounterMap,
    createEncounterFromRoom,
  }
}
