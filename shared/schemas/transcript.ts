import { z } from 'zod'

const queryInteger = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max)

/** Query contract for the agent transcript reader. Omitted values use service defaults. */
export const transcriptQuerySchema = z
  .object({
    versionId: z.string().uuid().optional(),
    startLine: queryInteger(1, 10_000_000).optional(),
    limit: queryInteger(1, 500).optional(),
    q: z.string().max(500).optional(),
    contextLines: queryInteger(0, 50).optional(),
    offset: queryInteger(0, 10_000_000).optional(),
  })
  .superRefine((query, ctx) => {
    const hasSearch = query.q !== undefined
    if (query.q !== undefined && query.q.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['q'], message: 'q must not be empty' })
    }
    if (hasSearch && query.startLine !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startLine'],
        message: 'startLine cannot be combined with q',
      })
    }
    if (!hasSearch && query.contextLines !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contextLines'],
        message: 'contextLines requires q',
      })
    }
    if (!hasSearch && query.offset !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['offset'],
        message: 'offset requires q',
      })
    }
  })

export type TranscriptQuery = z.infer<typeof transcriptQuerySchema>
