import { describe, expect, it } from 'vitest'
import { parseDiceNotation, rollDiceExpression, rollDice } from '../../shared/utils/dice'

describe('rollDice modes', () => {
  it.each([
    ['advantage', 17, 22],
    ['disadvantage', 8, 13],
  ] as const)('keeps both dice for %s and applies the modifier once', (mode, selectedRoll, total) => {
    const values = [0.35, 0.8]
    expect(rollDice('d20+5', mode, () => values.shift()!)).toEqual({
      notation: 'd20+5', mode, rolls: [8, 17], selectedRoll, modifier: 5, total,
    })
  })

  it('handles ties, negative modifiers, and an omitted modifier', () => {
    expect(rollDice('1d20-2', 'advantage', () => 0)).toMatchObject({ rolls: [1, 1], selectedRoll: 1, modifier: -2, total: -1 })
    expect(rollDice('d20', 'disadvantage', () => 0.99)).toMatchObject({ rolls: [20, 20], selectedRoll: 20, modifier: 0, total: 20 })
  })

  it('defaults to normal and preserves expression results', () => {
    expect(rollDice('2d6+3-d4', undefined, () => 0)).toEqual({
      ...rollDiceExpression('2d6+3-d4', () => 0), mode: 'normal',
    })
  })

  it.each(['2d20', 'd6+5', '-d20', 'd20+d4', '5', 'd20+2+3'])('rejects unsupported advantage/disadvantage notation: %s', (notation) => {
    for (const mode of ['advantage', 'disadvantage'] as const) {
      expect(() => rollDice(notation, mode)).toThrow('single d20')
    }
  })
})

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
