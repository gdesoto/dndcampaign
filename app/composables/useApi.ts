import type { FetchError } from 'ofetch'
import type { ApiError, ApiResponse } from '#server/utils/http'

type RequestOptions = Parameters<typeof $fetch>[1]

export type ApiRequestError = Error & { code?: string; fields?: Record<string, string>; statusCode?: number }

/** Turn a failed fetch into an Error carrying the server's `code`, `message`, and `fields`. */
const toApiRequestError = (error: unknown): ApiRequestError => {
  const fetchError = error as FetchError<ApiResponse<null>>
  const apiError: ApiError | null | undefined = fetchError?.data?.error
  const result = new Error(apiError?.message || fetchError?.message || 'Request failed', { cause: error }) as ApiRequestError
  result.code = apiError?.code
  result.fields = apiError?.fields
  result.statusCode = fetchError?.statusCode
  return result
}

export const useApi = () => {
  const serverHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}

  const request = async <T>(url: string, options: RequestOptions = {}) => {
    const optionHeaders = options.headers
      ? Object.fromEntries(new Headers(options.headers as HeadersInit))
      : {}

    let response: ApiResponse<T>
    try {
      response = await $fetch<ApiResponse<T>>(url, {
        credentials: 'include',
        headers: {
          ...serverHeaders,
          ...optionHeaders,
        },
        ...options,
      })
    } catch (error) {
      throw toApiRequestError(error)
    }

    if (response.error) {
      throw toApiRequestError({ data: response })
    }

    return response.data
  }

  return { request }
}
