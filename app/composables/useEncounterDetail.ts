import type { EncounterUpdateInput } from '#shared/schemas/encounter'
import type { EncounterDetail } from '#shared/types/encounter'

export function useEncounterDetail() {
  const { request } = useApi()

  const getEncounter = async (encounterId: string) => request<EncounterDetail>(`/api/encounters/${encounterId}`)

  const updateEncounter = async (encounterId: string, input: EncounterUpdateInput) =>
    request(`/api/encounters/${encounterId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteEncounter = async (encounterId: string) =>
    request(`/api/encounters/${encounterId}`, {
      method: 'DELETE',
    })

  const getSummary = async (encounterId: string) => request(`/api/encounters/${encounterId}/summary`)

  const getEvents = async (encounterId: string) => request(`/api/encounters/${encounterId}/events`)

  const addNoteEvent = async (encounterId: string, summary: string) =>
    request(`/api/encounters/${encounterId}/events/note`, {
      method: 'POST',
      body: { summary },
    })

  return {
    getEncounter,
    updateEncounter,
    deleteEncounter,
    getSummary,
    getEvents,
    addNoteEvent,
  }
}