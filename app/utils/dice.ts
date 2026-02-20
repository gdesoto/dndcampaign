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
  if (!rawTerms?.length) {
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
