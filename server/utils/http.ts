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

export const ok = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
})

export const fail = (
  eventOrStatusCode: H3Event | number,
  statusOrCode: number | string,
  codeOrMessage: string,
  messageOrFields?: string | Record<string, string>,
  maybeFields?: Record<string, string>
): ApiResponse<null> => {
  let statusCode: number
  let code: string
  let message: string
  let fields: Record<string, string> | undefined

  if (typeof eventOrStatusCode === 'number') {
    statusCode = eventOrStatusCode
    code = statusOrCode as string
    message = codeOrMessage
    fields = messageOrFields as Record<string, string> | undefined
  } else {
    statusCode = statusOrCode as number
    code = codeOrMessage
    message = (messageOrFields as string) || ''
    fields = maybeFields
    setResponseStatus(eventOrStatusCode, statusCode)
  }

  return {
    data: null,
    error: { code, message, fields: fields && Object.keys(fields).length ? fields : undefined },
  }
}
