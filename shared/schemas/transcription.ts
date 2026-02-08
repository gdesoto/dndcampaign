import { z } from 'zod'

const transcriptionFormatSchema = z.enum([
  'txt',
  'srt',
  'docx',
  'pdf',
  'html',
  'segmented_json',
])

const keytermSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((value) => value.split(/\s+/).length <= 5, {
    message: 'Keyterms can contain at most 5 words.',
  })

export const transcriptionStartSchema = z.object({
  formats: z.array(transcriptionFormatSchema).min(1),
  numSpeakers: z.number().int().min(1).max(32).optional(),
  keyterms: z.array(keytermSchema).max(100).optional(),
  diarize: z.boolean().optional().default(true),
  tagAudioEvents: z.boolean().optional().default(false),
  languageCode: z.string().min(2).max(10).optional(),
  modelId: z.string().min(1).max(50).optional().default('scribe_v2'),
})

export const transcriptionApplySchema = z.object({
  artifactId: z.string().uuid().optional(),
})

export const transcriptionAttachVttSchema = z.object({
  artifactId: z.string().uuid(),
  recordingId: z.string().uuid().optional(),
})

export const transcriptionImportSchema = z.object({
  transcriptionId: z.string().min(1).max(200),
})

export type TranscriptionStartInput = z.infer<typeof transcriptionStartSchema>
export type TranscriptionApplyInput = z.infer<typeof transcriptionApplySchema>
export type TranscriptionAttachVttInput = z.infer<typeof transcriptionAttachVttSchema>
export type TranscriptionImportInput = z.infer<typeof transcriptionImportSchema>
