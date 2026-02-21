import type { CalendarNameKind } from '#shared/types/calendar'

const MARKOV_ORDER = 2
const MAX_GENERATION_ATTEMPTS = 40

const weekdaySamples = [
  'Moonday', 'Tidesday', 'Windsday', 'Thundersday', 'Starsday', 'Sunsend', 'Firesday',
  'Dawnwatch', 'Nightwatch', 'Hallowday', 'Kingsday', 'Harvestday', 'Stormday', 'Emberday',
  'Mistday', 'Stoneward', 'Brightday', 'Gloomday', 'Sableday', 'Lightday',
]

const monthSamples = [
  'Dawnrise', 'Frostwane', 'Stormwake', 'Bloomtide', 'Suncrest', 'Highsummer', 'Goldfall',
  'Leafdrop', 'Duskmarch', 'Nightwane', 'Deepfrost', 'Emberturn', 'Raincall', 'Thawmoon',
  'Starwane', 'Mooncrest', 'Hearthfall', 'Brightwane', 'Wolfmoon', 'Longnight',
]

const moonSamples = [
  'Selun', 'Lunara', 'Nyx', 'Velis', 'Tharos', 'Ilyra', 'Myr', 'Orun', 'Cael', 'Eris',
  'Vesper', 'Astra', 'Noctis', 'Pale Eye', 'Silver Crown', 'Night Pearl', 'Glowring', 'Storm Orb',
]

const datasets: Record<CalendarNameKind, string[]> = {
  weekday: weekdaySamples,
  month: monthSamples,
  moon: moonSamples,
}

type RandomFn = () => number

const normalizeName = (value: string) =>
  value
    .replace(/[^a-zA-Z' -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const toTitleCase = (value: string) =>
  value
    .split(' ')
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ')

const hashSeed = (seed: string) => {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const createSeededRandom = (seed: string): RandomFn => {
  let state = hashSeed(seed) || 0x9e3779b9
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0xffffffff
  }
}

const randomItem = <T>(items: T[], random: RandomFn): T => {
  const index = Math.floor(random() * items.length)
  return items[Math.min(items.length - 1, Math.max(0, index))]!
}

type Chain = {
  starts: string[]
  transitions: Map<string, string[]>
}

const buildChain = (samples: string[]): Chain => {
  const starts: string[] = []
  const transitions = new Map<string, string[]>()

  for (const sample of samples) {
    const cleaned = normalizeName(sample).toLowerCase()
    if (!cleaned) continue

    const padded = `${'^'.repeat(MARKOV_ORDER)}${cleaned}$`
    starts.push(padded.slice(0, MARKOV_ORDER))

    for (let index = 0; index <= padded.length - MARKOV_ORDER - 1; index += 1) {
      const key = padded.slice(index, index + MARKOV_ORDER)
      const next = padded[index + MARKOV_ORDER]
      if (!next) continue
      const bucket = transitions.get(key)
      if (bucket) {
        bucket.push(next)
      }
      else {
        transitions.set(key, [next])
      }
    }
  }

  return { starts, transitions }
}

const generateFromChain = (
  chain: Chain,
  random: RandomFn,
  minLength = 4,
  maxLength = 14,
): string | null => {
  if (!chain.starts.length || !chain.transitions.size) return null

  let state = randomItem(chain.starts, random)
  let output = ''

  for (let steps = 0; steps < maxLength + 8; steps += 1) {
    const nextCandidates = chain.transitions.get(state)
    if (!nextCandidates?.length) break

    const nextChar = randomItem(nextCandidates, random)
    if (nextChar === '$') break
    if (nextChar !== '^') output += nextChar
    state = `${state.slice(1)}${nextChar}`
  }

  const normalized = normalizeName(toTitleCase(output))
  if (normalized.length < minLength || normalized.length > maxLength) {
    return null
  }

  return normalized
}

export class NameGeneratorService {
  private chainCache = new Map<CalendarNameKind, Chain>()

  private getChain(kind: CalendarNameKind) {
    const cached = this.chainCache.get(kind)
    if (cached) return cached
    const chain = buildChain(datasets[kind])
    this.chainCache.set(kind, chain)
    return chain
  }

  generateNames(kind: CalendarNameKind, count = 1, seed?: string): string[] {
    const chain = this.getChain(kind)
    const random = seed ? createSeededRandom(seed) : Math.random
    const normalizedCount = Math.min(50, Math.max(1, Math.trunc(count)))
    const generated = new Set<string>()
    const fallbackPool = datasets[kind].map((entry) => normalizeName(toTitleCase(entry))).filter(Boolean)

    let attempts = 0
    while (generated.size < normalizedCount && attempts < normalizedCount * MAX_GENERATION_ATTEMPTS) {
      attempts += 1
      const candidate = generateFromChain(chain, random)
      if (!candidate) continue
      generated.add(candidate)
    }

    while (generated.size < normalizedCount && fallbackPool.length) {
      generated.add(randomItem(fallbackPool, random))
    }

    return [...generated]
  }
}
