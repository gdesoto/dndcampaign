type RuntimeConfigSnapshot = {
  generatedAt: string
  values: Record<string, unknown>
}

const REDACTION_PATTERNS: RegExp[] = [
  /password/i,
  /secret/i,
  /token/i,
  /apiKey/i,
  /key$/i,
]

const shouldRedactKey = (key?: string) => {
  if (!key) return false
  return REDACTION_PATTERNS.some((pattern) => pattern.test(key))
}

const redactValue = (value: unknown, key?: string): unknown => {
  if (shouldRedactKey(key)) return '***redacted***'
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry))
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return Object.fromEntries(
      entries.map(([entryKey, entryValue]) => [
        entryKey,
        redactValue(entryValue, entryKey),
      ])
    )
  }

  return value
}

export const getRuntimeConfigSnapshot = (): RuntimeConfigSnapshot => {
  const runtimeConfig = useRuntimeConfig()

  return {
    generatedAt: new Date().toISOString(),
    values: redactValue(runtimeConfig) as Record<string, unknown>,
  }
}

export type { RuntimeConfigSnapshot }
