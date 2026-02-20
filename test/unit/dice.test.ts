import { describe, expect, it } from 'vitest'
import { parseDiceNotation, rollDiceExpression } from '../../app/utils/dice'

describe('parseDiceNotation', () => {
  it('parses mixed dice and flat modifiers', () => {
    expect(parseDiceNotation('2d6+3-d4')).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6 },
      { kind: 'flat', sign: 1, value: 3 },
      { kind: 'dice', sign: -1, count: 1, sides: 4 },
    ])
  })

  it('supports shorthand d20 notation', () => {
    expect(parseDiceNotation('d20')).toEqual([{ kind: 'dice', sign: 1, count: 1, sides: 20 }])
  })

  it('rejects invalid notation', () => {
    expect(() => parseDiceNotation('2d')).toThrow('Invalid term')
    expect(() => parseDiceNotation('')).toThrow('Enter a dice notation')
    expect(() => parseDiceNotation('1d1')).toThrow('Dice sides must be between 2 and 1000.')
  })
})

describe('rollDiceExpression', () => {
  it('rolls deterministically when rng is provided', () => {
    const values = [0.0, 0.5, 0.99]
    let index = 0
    const rng = () => values[index++]!

    const result = rollDiceExpression('2d6+3-1d4', rng)

    expect(result.total).toBe(4)
    expect(result.terms).toEqual([
      { kind: 'dice', sign: 1, count: 2, sides: 6, rolls: [1, 4], subtotal: 5 },
      { kind: 'flat', sign: 1, value: 3, subtotal: 3 },
      { kind: 'dice', sign: -1, count: 1, sides: 4, rolls: [4], subtotal: -4 },
    ])
  })
})
