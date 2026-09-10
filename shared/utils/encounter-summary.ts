import type { EncounterSummaryReport } from '../types/encounter'

export function buildEncounterSummary(encounter: {
  id: string
  currentRound: number
  combatants: { isDefeated: boolean }[]
  events: { payload?: unknown }[]
}): EncounterSummaryReport {
  let totalDamage = 0
  let totalHealing = 0
  for (const event of encounter.events) {
    const payload = event.payload as Record<string, unknown> | null | undefined
    const amount = typeof payload?.amount === 'number' ? payload.amount : 0
    if (payload?.action === 'hp.damage') totalDamage += amount
    if (payload?.action === 'hp.heal') totalHealing += amount
  }

  return {
    encounterId: encounter.id,
    rounds: encounter.currentRound,
    totalEvents: encounter.events.length,
    totalDamage,
    totalHealing,
    defeatedCombatants: encounter.combatants.filter(combatant => combatant.isDefeated).length,
  }
}
