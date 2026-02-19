import type { H3Event } from 'h3'
import { getRequestIP, setHeader } from 'h3'
import { createHash } from 'node:crypto'
import { fail } from '#server/utils/http'

type RateLimitOptions = {
  key: string
  max: number
  windowMs: number
}

type RateLimitRecord = {
  count: number
  resetAt: number
}

const RATE_LIMIT_CLEANUP_MS = 60_000
const RATE_LIMIT_STATE_KEY = '__dndcampaign_rate_limit_state__'

type RateLimitState = {
  records: Map<string, RateLimitRecord>
  lastCleanupAt: number
}

const getState = (): RateLimitState => {
  const globalRef = globalThis as typeof globalThis & {
    [RATE_LIMIT_STATE_KEY]?: RateLimitState
  }

  if (!globalRef[RATE_LIMIT_STATE_KEY]) {
    globalRef[RATE_LIMIT_STATE_KEY] = {
      records: new Map<string, RateLimitRecord>(),
      lastCleanupAt: Date.now(),
    }
  }

  return globalRef[RATE_LIMIT_STATE_KEY]
}

const hashKeyPart = (value: string) => createHash('sha256').update(value).digest('hex')

const getClientIdentifier = (event: H3Event, key: string) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  return `${key}:${hashKeyPart(ip)}`
}

const maybeCleanup = (state: RateLimitState, now: number) => {
  if (now - state.lastCleanupAt < RATE_LIMIT_CLEANUP_MS) {
    return
  }

  for (const [key, value] of state.records.entries()) {
    if (value.resetAt <= now) {
      state.records.delete(key)
    }
  }
  state.lastCleanupAt = now
}

export const enforceRateLimit = (event: H3Event, options: RateLimitOptions) => {
  const now = Date.now()
  const state = getState()
  maybeCleanup(state, now)

  const identifier = getClientIdentifier(event, options.key)
  const existing = state.records.get(identifier)

  const record =
    !existing || existing.resetAt <= now
      ? { count: 1, resetAt: now + options.windowMs }
      : { ...existing, count: existing.count + 1 }

  state.records.set(identifier, record)

  if (record.count > options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000))
    setHeader(event, 'Retry-After', retryAfterSeconds)
    return fail(event, 429, 'RATE_LIMITED', 'Too many requests. Please try again shortly.')
  }

  return null
}
