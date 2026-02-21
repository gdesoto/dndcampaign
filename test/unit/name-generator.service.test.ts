import { describe, expect, it } from 'vitest'
import { NameGeneratorService } from '../../server/services/calendar/name-generator.service'

describe('calendar name generator service', () => {
  it('produces deterministic names when seed is provided', () => {
    const service = new NameGeneratorService()
    const first = service.generateNames('weekday', 6, 'seed-a')
    const second = service.generateNames('weekday', 6, 'seed-a')

    expect(second).toEqual(first)
  })

  it('supports different outputs for different seeds', () => {
    const service = new NameGeneratorService()
    const first = service.generateNames('month', 6, 'seed-a')
    const second = service.generateNames('month', 6, 'seed-b')

    expect(second).not.toEqual(first)
  })

  it('caps requested count and returns at least one value', () => {
    const service = new NameGeneratorService()
    expect(service.generateNames('moon', 0).length).toBe(1)
    expect(service.generateNames('moon', 200).length).toBeLessThanOrEqual(50)
  })
})
