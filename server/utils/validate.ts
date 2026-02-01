import type { H3Event } from 'h3'
import { readBody } from 'h3'
import type { ZodSchema } from 'zod'

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> }

export const readValidatedBodySafe = async <T>(
  event: H3Event,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> => {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (parsed.success) {
    return { success: true, data: parsed.data }
  }

  const fieldErrors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || 'body'
    fieldErrors[key] = issue.message
  }
  return { success: false, fieldErrors }
}
