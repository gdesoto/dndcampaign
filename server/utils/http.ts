import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export type ApiError = {
  code: string
  message: string
  fields?: Record<string, string>
}

export type ApiResponse<T> = {
  data: T | null
  error: ApiError | null
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      statusCode: number
      code: string
      message: string
      fields?: Record<string, string>
    }

export const ok = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
})

export const fail = (
  event: H3Event,
  statusCode: number,
  code: string,
  message = '',
  fields?: Record<string, string>
): ApiResponse<null> => {
  setResponseStatus(event, statusCode)
  return {
    data: null,
    error: { code, message, fields: fields && Object.keys(fields).length ? fields : undefined },
  }
}

/** Translate a service result into the API envelope, setting the HTTP status on failure. */
export const respond = <T>(event: H3Event, result: ServiceResult<T>): ApiResponse<T | null> =>
  result.ok
    ? ok(result.data)
    : fail(event, result.statusCode, result.code, result.message, result.fields)
