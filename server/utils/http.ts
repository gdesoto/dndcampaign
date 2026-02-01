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
  statusCode: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): ApiResponse<null> => {
  setResponseStatus(statusCode)
  return {
    data: null,
    error: { code, message, fields },
  }
}
