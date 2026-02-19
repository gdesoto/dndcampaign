import type { ApiResponse } from '#server/utils/http'

type RequestOptions = Parameters<typeof $fetch>[1]

export const useApi = () => {
  const request = async <T>(url: string, options: RequestOptions = {}) => {
    const serverHeaders = import.meta.server ? useRequestHeaders(['cookie']) : {}
    const optionHeaders = options.headers
      ? Object.fromEntries(new Headers(options.headers as HeadersInit))
      : {}
    const response = await $fetch<ApiResponse<T>>(url, {
      credentials: 'include',
      headers: {
        ...serverHeaders,
        ...optionHeaders,
      },
      ...options,
    })

    if (response.error) {
      const error = new Error(response.error.message)
      ;(error as Error & { code?: string; fields?: Record<string, string> }).code =
        response.error.code
      ;(error as Error & { code?: string; fields?: Record<string, string> }).fields =
        response.error.fields
      throw error
    }

    return response.data
  }

  return { request }
}
