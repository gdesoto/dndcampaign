import { describe, expect, it } from 'vitest'
import {
  defaultMapLayerTypes,
  mapFeatureFilterSchema,
  mapGlossaryCommitSchema,
  mapGlossaryStageSchema,
  mapPatchSchema,
  mapReimportApplySchema,
} from '../../shared/schemas/map'

describe('map schemas', () => {
  it('validates map patch payload', () => {
    const parsed = mapPatchSchema.safeParse({
      name: 'New Name',
      status: 'ACTIVE',
      isPrimary: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('validates feature filter and defaults includeRemoved', () => {
    const parsed = mapFeatureFilterSchema.parse({
      types: ['state', 'river'],
    })
    expect(parsed.includeRemoved).toBe(false)
    expect(defaultMapLayerTypes).toEqual(['state', 'marker', 'river', 'burg', 'route'])
  })

  it('requires staging feature ids and commit items', () => {
    expect(mapGlossaryStageSchema.safeParse({ featureIds: [] }).success).toBe(false)
    expect(
      mapGlossaryCommitSchema.safeParse({
        items: [{ featureId: 'bad', action: 'create' }],
      }).success
    ).toBe(false)
  })

  it('validates reimport strategy payload', () => {
    const parsed = mapReimportApplySchema.safeParse({
      strategy: 'replace_relink_by_name',
      keepPrimary: 'true',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.keepPrimary).toBe(true)
    }
  })
})
