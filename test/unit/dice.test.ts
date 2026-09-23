import { expect, it } from 'vitest'
import { rollDice } from '../../shared/utils/dice'

it('rolls mixed expressions and applies advantage or disadvantage with one modifier', () => {
  const expressionRolls = [0, 0.5, 0.99]
  expect(rollDice('2d6+3-d4', undefined, () => expressionRolls.shift()!)).toMatchObject({
    mode: 'normal', total: 4,
    terms: [{ rolls: [1, 4], subtotal: 5 }, { subtotal: 3 }, { rolls: [4], subtotal: -4 }],
  })
  const advantageRolls = [0.35, 0.8]
  expect(rollDice('d20+5', 'advantage', () => advantageRolls.shift()!)).toMatchObject({
    rolls: [8, 17], selectedRoll: 17, modifier: 5, total: 22,
  })
  const disadvantageRolls = [0.35, 0.8]
  expect(rollDice('d20-2', 'disadvantage', () => disadvantageRolls.shift()!)).toMatchObject({
    rolls: [8, 17], selectedRoll: 8, modifier: -2, total: 6,
  })
  expect(rollDice('d20', 'advantage', () => 0)).toMatchObject({ rolls: [1, 1], total: 1 })
})

it('rejects malformed, excessive, and unsupported rolls', () => {
  expect(() => rollDice('2d')).toThrow('Invalid term')
  expect(() => rollDice('1d1')).toThrow('Dice sides must be between 2 and 1000.')
  expect(() => rollDice('101d6')).toThrow()
  expect(() => rollDice('d'.repeat(201))).toThrow()
  expect(() => rollDice('d20++3')).toThrow()
  expect(() => rollDice('2d20', 'advantage')).toThrow('single d20')
  expect(() => rollDice('d20+d4', 'disadvantage')).toThrow('single d20')
})
