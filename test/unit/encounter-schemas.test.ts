import { describe, expect, it } from 'vitest'
import {
  encounterLifecycleSchema,
  encounterConditionCreateSchema,
  encounterDamageSchema,
} from '../../shared/schemas/encounter'

describe('encounter schemas', () => {
  it('accepts valid lifecycle transitions', () => {
    const parsed = encounterLifecycleSchema.safeParse({ action: 'start' })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid lifecycle transitions', () => {
    const parsed = encounterLifecycleSchema.safeParse({ action: 'unknown' })
    expect(parsed.success).toBe(false)
  })

  it('rejects negative condition duration', () => {
    const parsed = encounterConditionCreateSchema.safeParse({ name: 'Bless', duration: -1 })
    expect(parsed.success).toBe(false)
  })

  it('requires positive damage amount', () => {
    const parsed = encounterDamageSchema.safeParse({ amount: 0 })
    expect(parsed.success).toBe(false)
  })
})