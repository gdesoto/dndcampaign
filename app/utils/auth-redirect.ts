const DEFAULT_AUTH_REDIRECT_PATH = '/campaigns'
const DISALLOWED_REDIRECT_PATHS = ['/login', '/register']

const toRedirectCandidate = (value: unknown): string | null => {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (typeof rawValue !== 'string') {
    return null
  }

  const trimmed = rawValue.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null
  }

  return trimmed
}

export const resolveAuthRedirectPath = (
  value: unknown,
  fallbackPath = DEFAULT_AUTH_REDIRECT_PATH
): string => {
  const candidate = toRedirectCandidate(value)
  if (!candidate) {
    return fallbackPath
  }

  const isDisallowed = DISALLOWED_REDIRECT_PATHS.some(
    (path) =>
      candidate === path
      || candidate.startsWith(`${path}/`)
      || candidate.startsWith(`${path}?`)
      || candidate.startsWith(`${path}#`)
  )
  if (isDisallowed) {
    return fallbackPath
  }

  return candidate
}
