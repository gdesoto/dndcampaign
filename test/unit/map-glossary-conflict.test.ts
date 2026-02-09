import { describe, expect, it } from 'vitest'
import { buildGlossaryConflictCandidates } from '../../server/services/map-conflict.utils'

describe('map glossary conflict detection', () => {
  it('prioritizes direct feature linkage and exact name matches', () => {
    const candidates = buildGlossaryConflictCandidates(
      [
        {
          id: 'g1',
          type: 'LOCATION',
          name: 'Storm Crown',
          normalizedName: 'storm crown',
          sourceMapFeatureId: null,
        },
        {
          id: 'g2',
          type: 'LOCATION',
          name: 'Volcanic Spire',
          normalizedName: 'volcanic spire',
          sourceMapFeatureId: 'f1',
        },
      ],
      { id: 'f1', normalizedName: 'storm crown' }
    )

    expect(candidates[0]?.glossaryEntryId).toBe('g2')
    expect(candidates[0]?.confidence).toBe(1)
    expect(candidates.some((entry) => entry.glossaryEntryId === 'g1')).toBe(true)
  })

  it('returns fuzzy token matches when overlap is high enough', () => {
    const candidates = buildGlossaryConflictCandidates(
      [
        {
          id: 'g1',
          type: 'LOCATION',
          name: 'Northwatch Fortress Citadel',
          normalizedName: 'northwatch fortress citadel',
          sourceMapFeatureId: null,
        },
      ],
      { id: 'f2', normalizedName: 'northwatch fortress citadel' }
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.confidence).toBeGreaterThanOrEqual(0.72)
  })
})
