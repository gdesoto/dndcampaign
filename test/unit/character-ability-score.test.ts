import { expect, it } from 'vitest'
import { characterAbilityScore } from '../../app/utils/characterAbilityScore'

it('reads supported imported scores without inventing missing values', () => {
  expect(characterAbilityScore(14)).toBe(14)
  expect(characterAbilityScore({ base: 12, total: 14 })).toBe(14)
  expect(characterAbilityScore({ base: 12 })).toBe(12)
  expect(characterAbilityScore(undefined)).toBeUndefined()
  expect(characterAbilityScore({ total: Infinity })).toBeUndefined()
})
