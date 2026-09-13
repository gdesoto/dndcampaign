import type { H3Event } from 'h3'
import { createError, getRouterParams } from 'h3'

export type ApiError = {
  code: string
  message: string
  fields?: Record<string, string>
}

export type ApiResponse<T> = {
  data: T | null
  error: ApiError | null
}

/** Extra payload carried on thrown H3 errors; the Nitro error handler shapes it into `ApiError`. */
export type ApiErrorData = {
  code: string
  fields?: Record<string, string>
}

export const ok = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
})

/**
 * Build an HTTP error to throw from handlers, utils, or services.
 * `server/error-handler.ts` turns it into the `{ data: null, error }` envelope.
 */
export const apiError = (
  statusCode: number,
  code: string,
  message = '',
  fields?: Record<string, string>
) =>
  createError({
    statusCode,
    message,
    data: {
      code,
      fields: fields && Object.keys(fields).length ? fields : undefined,
    } satisfies ApiErrorData,
  })

/** Read required route params as plain strings, e.g. `const { campaignId } = routeParams(event, 'campaignId')`. */
export const routeParams = <K extends string>(event: H3Event, ...keys: K[]): Record<K, string> => {
  const params = getRouterParams(event)
  const result = {} as Record<K, string>
  for (const key of keys) {
    const value = params[key]
    if (!value) {
      throw apiError(400, 'VALIDATION_ERROR', `${key} is required`)
    }
    result[key] = value
  }
  return result
}
