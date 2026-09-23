import { describe, expect, it } from 'vitest'
import { getEncounterActions } from '../../shared/utils/encounter-policy'
describe('encounter phases', () => {
  it('separates preparation, runtime, pause and finished records', () => {
    expect(getEncounterActions('PLANNED', 1)).toMatchObject({ start: { allowed: true }, turn: { allowed: false }, initiative: { allowed: true }, effects: { allowed: false } })
    expect(getEncounterActions('ACTIVE', 1)).toMatchObject({ turn: { allowed: true }, effects: { allowed: true }, pause: { allowed: true }, start: { allowed: false } })
    expect(getEncounterActions('PAUSED', 1)).toMatchObject({ turn: { allowed: false }, effects: { allowed: true }, participants: { allowed: true }, resume: { allowed: true } })
    for (const status of ['COMPLETED', 'ABANDONED'] as const) {
      expect(getEncounterActions(status, 1)).toMatchObject({ reopen: { allowed: true }, turn: { allowed: false }, participants: { allowed: false }, edit: { allowed: false }, reset: { allowed: false } })
    }
  })
  it('gates empty encounters and read-only callers', () => {
    expect(getEncounterActions('PLANNED', 0).start.allowed).toBe(false)
    expect(getEncounterActions('ACTIVE', 0).turn.allowed).toBe(false)
    expect(Object.values(getEncounterActions('ACTIVE', 2, false)).every(action => !action.allowed)).toBe(true)
  })
})
