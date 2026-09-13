import { send, setResponseHeader, setResponseStatus } from 'h3'
import { defineNitroErrorHandler } from 'nitropack/runtime'
import type { ApiErrorData, ApiResponse } from '#server/utils/http'

const defaultCodes: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
}

/**
 * Shapes every error thrown under `/api/` into the `{ data: null, error }` envelope.
 * Non-API requests fall through to Nuxt's own error page handler.
 */
export default defineNitroErrorHandler((error, event) => {
  if (!event.path.startsWith('/api/')) {
    return
  }

  const statusCode = error.statusCode || 500
  const data = (error.data ?? {}) as Partial<ApiErrorData>
  const isServerError = statusCode >= 500

  if (isServerError) {
    console.error(`[api] ${event.method} ${event.path}`, error)
  }

  const body: ApiResponse<null> = {
    data: null,
    error: {
      code: data.code || defaultCodes[statusCode] || 'INTERNAL_ERROR',
      message:
        isServerError && !data.code && !import.meta.dev ? 'Internal server error' : error.message || '',
      fields: data.fields,
    },
  }

  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  return send(event, JSON.stringify(body))
})
