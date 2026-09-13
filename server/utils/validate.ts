import type { H3Event } from 'h3'
import { getQuery, readBody } from 'h3'
import type { ZodIssue, ZodSchema } from 'zod'
import { apiError } from '#server/utils/http'

export const zodIssuesToFieldErrors = (issues: ZodIssue[]): Record<string, string> =>
  Object.fromEntries(issues.map((issue) => [issue.path.join('.') || 'body', issue.message]))

/** Validate any input against a schema, throwing a 400 with field errors on failure. */
export const validateInput = <T>(
  schema: ZodSchema<T>,
  input: unknown,
  message = 'Invalid request payload'
): T => {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', message, zodIssuesToFieldErrors(parsed.error.issues))
  }
  return parsed.data
}

export const validateBody = async <T>(event: H3Event, schema: ZodSchema<T>, message?: string) =>
  validateInput(schema, (await readBody(event)) ?? {}, message)

export const validateQuery = <T>(event: H3Event, schema: ZodSchema<T>, message = 'Invalid query') =>
  validateInput(schema, getQuery(event), message)
