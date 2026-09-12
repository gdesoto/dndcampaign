import type { H3Event } from 'h3'
import { getQuery, readBody } from 'h3'
import type { ZodIssue, ZodSchema } from 'zod'
import type { ApiResponse } from '#server/utils/http'
import { fail } from '#server/utils/http'

export type Validated<T> =
  | { ok: true; data: T }
  | { ok: false; response: ApiResponse<null> }

export const zodIssuesToFieldErrors = (issues: ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((issue) => [issue.path.join('.') || 'body', issue.message]))

/** Validate any input against a schema, producing a ready-to-return 400 envelope on failure. */
export const validateInput = <T>(
  event: H3Event,
  schema: ZodSchema<T>,
  input: unknown,
  message = 'Invalid request payload'
): Validated<T> => {
  const parsed = schema.safeParse(input)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  return {
    ok: false,
    response: fail(event, 400, 'VALIDATION_ERROR', message, zodIssuesToFieldErrors(parsed.error.issues)),
  }
}

export const validateBody = async <T>(event: H3Event, schema: ZodSchema<T>, message?: string) =>
  validateInput(event, schema, (await readBody(event)) ?? {}, message)

export const validateQuery = <T>(event: H3Event, schema: ZodSchema<T>, message = 'Invalid query') =>
  validateInput(event, schema, getQuery(event), message)
