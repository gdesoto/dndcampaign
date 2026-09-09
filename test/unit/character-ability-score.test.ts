import { expect, it } from 'vitest'
import { characterAbilityScore } from '../../app/utils/characterAbilityScore'

it.each([
  [14, 14], [{ base: 12, total: 14 }, 14], [{ base: 12 }, 12],
  [0, 0], [undefined, undefined], [{}, undefined], ['14', undefined],
  [NaN, undefined], [{ total: Infinity }, undefined],
])('reads an imported ability score %j as %j', (input, expected) => {
  expect(characterAbilityScore(input)).toBe(expected)
})
