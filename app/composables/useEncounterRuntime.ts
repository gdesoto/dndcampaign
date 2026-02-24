import type {
  EncounterCombatantCreateInput,
  EncounterCombatantUpdateInput,
  EncounterConditionCreateInput,
  EncounterConditionUpdateInput,
  EncounterInitiativeRollInput,
  EncounterInitiativeReorderInput,
  EncounterSetActiveTurnInput,
} from '#shared/schemas/encounter'

export function useEncounterRuntime() {
  const { request } = useApi()

  const start = async (encounterId: string) => request(`/api/encounters/${encounterId}/start`, { method: 'POST' })
  const pause = async (encounterId: string) => request(`/api/encounters/${encounterId}/pause`, { method: 'POST' })
  const resume = async (encounterId: string) => request(`/api/encounters/${encounterId}/resume`, { method: 'POST' })
  const complete = async (encounterId: string) => request(`/api/encounters/${encounterId}/complete`, { method: 'POST' })
  const abandon = async (encounterId: string) => request(`/api/encounters/${encounterId}/abandon`, { method: 'POST' })
  const reset = async (encounterId: string) => request(`/api/encounters/${encounterId}/reset`, { method: 'POST' })

  const rollInitiative = async (encounterId: string, input?: EncounterInitiativeRollInput) =>
    request(`/api/encounters/${encounterId}/initiative/roll`, {
      method: 'POST',
      body: input || { mode: 'ALL' },
    })

  const reorderInitiative = async (encounterId: string, input: EncounterInitiativeReorderInput) =>
    request(`/api/encounters/${encounterId}/initiative/reorder`, {
      method: 'POST',
      body: input,
    })

  const advanceTurn = async (encounterId: string) =>
    request(`/api/encounters/${encounterId}/turn/advance`, { method: 'POST' })

  const rewindTurn = async (encounterId: string) =>
    request(`/api/encounters/${encounterId}/turn/rewind`, { method: 'POST' })

  const setActiveTurn = async (encounterId: string, input: EncounterSetActiveTurnInput) =>
    request(`/api/encounters/${encounterId}/turn/set-active`, {
      method: 'POST',
      body: input,
    })

  const listCombatants = async (encounterId: string) =>
    request(`/api/encounters/${encounterId}/combatants`)

  const createCombatant = async (encounterId: string, input: EncounterCombatantCreateInput) =>
    request(`/api/encounters/${encounterId}/combatants`, {
      method: 'POST',
      body: input,
    })

  const updateCombatant = async (
    encounterId: string,
    combatantId: string,
    input: EncounterCombatantUpdateInput,
  ) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteCombatant = async (encounterId: string, combatantId: string) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}`, { method: 'DELETE' })

  const applyDamage = async (encounterId: string, combatantId: string, amount: number, note?: string) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}/apply-damage`, {
      method: 'POST',
      body: { amount, note },
    })

  const applyHeal = async (encounterId: string, combatantId: string, amount: number, note?: string) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}/apply-heal`, {
      method: 'POST',
      body: { amount, note },
    })

  const addCondition = async (encounterId: string, combatantId: string, input: EncounterConditionCreateInput) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}/conditions`, {
      method: 'POST',
      body: input,
    })

  const updateCondition = async (
    encounterId: string,
    combatantId: string,
    conditionId: string,
    input: EncounterConditionUpdateInput,
  ) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}/conditions/${conditionId}`, {
      method: 'PATCH',
      body: input,
    })

  const deleteCondition = async (encounterId: string, combatantId: string, conditionId: string) =>
    request(`/api/encounters/${encounterId}/combatants/${combatantId}/conditions/${conditionId}`, {
      method: 'DELETE',
    })

  return {
    start,
    pause,
    resume,
    complete,
    abandon,
    reset,
    rollInitiative,
    reorderInitiative,
    advanceTurn,
    rewindTurn,
    setActiveTurn,
    listCombatants,
    createCombatant,
    updateCombatant,
    deleteCombatant,
    applyDamage,
    applyHeal,
    addCondition,
    updateCondition,
    deleteCondition,
  }
}
