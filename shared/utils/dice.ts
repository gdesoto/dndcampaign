export type DiceTerm = {
  kind: 'dice'
  sign: 1 | -1
  count: number
  sides: number
}

export type FlatTerm = {
  kind: 'flat'
  sign: 1 | -1
  value: number
}

export type DiceExpressionTerm = DiceTerm | FlatTerm

export type RolledDiceTerm = DiceTerm & {
  rolls: number[]
  subtotal: number
}

export type RolledFlatTerm = FlatTerm & {
  subtotal: number
}

export type RolledTerm = RolledDiceTerm | RolledFlatTerm

export type RollResult = {
  notation: string
  total: number
  terms: RolledTerm[]
}

type DiceParserOptions = {
  maxDiceCount?: number
  maxSides?: number
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export const rollDice = (
  notation: string,
  mode: RollMode = 'normal',
  rng: () => number = Math.random
) => {
  if (mode === 'normal') return { ...rollDiceExpression(notation, rng), mode }

  const terms = parseDiceNotation(notation)
  const die = terms[0]
  const flat = terms[1]
  if (terms.length > 2 || die?.kind !== 'dice' || die.count !== 1 || die.sides !== 20 || die.sign !== 1 || (flat && flat.kind !== 'flat')) {
    throw new Error('Advantage and disadvantage require a single d20 with an optional integer modifier, such as d20+5.')
  }
  const modifier = flat?.kind === 'flat' ? flat.sign * flat.value : 0
  const rolled = rollDiceExpression('2d20', rng).terms[0] as RolledDiceTerm
  const rolls = rolled.rolls
  const selectedRoll = mode === 'advantage' ? Math.max(...rolls) : Math.min(...rolls)
  return { notation, mode, rolls, selectedRoll, modifier, total: selectedRoll + modifier }
}

const DEFAULT_MAX_DICE_COUNT = 100
const DEFAULT_MAX_SIDES = 1000

export const parseDiceNotation = (
  notation: string,
  options: DiceParserOptions = {}
): DiceExpressionTerm[] => {
  const maxDiceCount = options.maxDiceCount ?? DEFAULT_MAX_DICE_COUNT
  const maxSides = options.maxSides ?? DEFAULT_MAX_SIDES
  const normalized = notation.replace(/\s+/g, '').toLowerCase()

  if (!normalized) {
    throw new Error('Enter a dice notation like 2d6+3.')
  }
  if (!/^[+-]?[0-9d+-]+$/.test(normalized)) {
    throw new Error('Only digits, d, +, and - are allowed.')
  }

  const rawTerms = normalized.match(/[+-]?[^+-]+/g)
  if (!rawTerms?.length || rawTerms.join('') !== normalized) {
    throw new Error('Notation is invalid.')
  }

  return rawTerms.map((raw) => {
    const sign: 1 | -1 = raw.startsWith('-') ? -1 : 1
    const body = raw.replace(/^[+-]/, '')
    if (!body) {
      throw new Error('Notation is invalid.')
    }

    const diceMatch = body.match(/^(\d*)d(\d+)$/)
    if (diceMatch) {
      const count = Number(diceMatch[1] || '1')
      const sides = Number(diceMatch[2])
      if (!Number.isInteger(count) || count < 1 || count > maxDiceCount) {
        throw new Error(`Dice count must be between 1 and ${maxDiceCount}.`)
      }
      if (!Number.isInteger(sides) || sides < 2 || sides > maxSides) {
        throw new Error(`Dice sides must be between 2 and ${maxSides}.`)
      }
      return {
        kind: 'dice' as const,
        sign,
        count,
        sides,
      }
    }

    if (/^\d+$/.test(body)) {
      const value = Number(body)
      if (!Number.isSafeInteger(value)) {
        throw new Error('Modifiers must be safe integers.')
      }
      return {
        kind: 'flat' as const,
        sign,
        value,
      }
    }

    throw new Error(`Invalid term "${body}".`)
  })
}

export const rollDiceExpression = (
  notation: string,
  rng: () => number = Math.random
): RollResult => {
  const terms = parseDiceNotation(notation)
  const rolledTerms: RolledTerm[] = terms.map((term) => {
    if (term.kind === 'flat') {
      const subtotal = term.sign * term.value
      return { ...term, subtotal }
    }
    const rolls = Array.from({ length: term.count }, () => Math.floor(rng() * term.sides) + 1)
    const rawTotal = rolls.reduce((sum, value) => sum + value, 0)
    const subtotal = term.sign * rawTotal
    return { ...term, rolls, subtotal }
  })

  return {
    notation,
    terms: rolledTerms,
    total: rolledTerms.reduce((sum, term) => sum + term.subtotal, 0),
  }
}
