import { z } from 'zod'

export const documentCreateSchema = z.object({
  type: z.enum(['TRANSCRIPT', 'SUMMARY', 'NOTES']),
  title: z.string().min(1).max(200),
  content: z.string().max(2000000).optional().default(''),
  format: z.enum(['MARKDOWN', 'PLAINTEXT']).optional().default('MARKDOWN'),
})

export const documentUpdateSchema = z.object({
  content: z.string().max(2000000),
  format: z.enum(['MARKDOWN', 'PLAINTEXT']).optional().default('MARKDOWN'),
})

export const documentRestoreSchema = z.object({
  versionId: z.string().uuid(),
})

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>
export type DocumentRestoreInput = z.infer<typeof documentRestoreSchema>
