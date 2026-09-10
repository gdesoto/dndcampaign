import { describe, expect, it } from 'vitest'
import { buildEncounterSummary } from '../../shared/utils/encounter-summary'

describe('encounter summary', () => {
  it('counts only numeric HP changes while retaining all events and defeated combatants', () => {
    expect(buildEncounterSummary({
      id: 'encounter-1',
      currentRound: 3,
      combatants: [{ isDefeated: true }, { isDefeated: false }],
      events: [
        { payload: { action: 'hp.damage', amount: 8 } },
        { payload: { action: 'hp.damage', amount: 2 } },
        { payload: { action: 'hp.heal', amount: 4 } },
        { payload: { action: 'note', amount: 100 } },
        { payload: { action: 'hp.damage', amount: '5' } },
        { payload: null },
      ],
    })).toEqual({ encounterId: 'encounter-1', rounds: 3, totalEvents: 6, totalDamage: 10, totalHealing: 4, defeatedCombatants: 1 })
  })

  it('handles an encounter with no events or combatants', () => {
    expect(buildEncounterSummary({ id: 'empty', currentRound: 1, events: [], combatants: [] }))
      .toEqual({ encounterId: 'empty', rounds: 1, totalEvents: 0, totalDamage: 0, totalHealing: 0, defeatedCombatants: 0 })
  })
})
