import { z } from 'zod'

export const summarizeRequestSchema = z.object({
  webhookUrlOverride: z.string().url().optional(),
  promptProfile: z.string().max(2000).optional(),
  mode: z.enum(['sync', 'async']).default('async'),
})

export const summaryJobKindSchema = z.enum(['SUMMARY_GENERATION', 'SUGGESTION_GENERATION'])

export const n8nRequestPayloadSchema = z.object({
  trackingId: z.string().min(1).max(200),
  campaignId: z.string().min(1),
  sessionId: z.string().min(1),
  documentId: z.string().min(1),
  transcript: z.object({
    format: z.enum(['MARKDOWN', 'PLAINTEXT']).optional(),
    readOnly: z.boolean().optional(),
    content: z.string(),
    hash: z.string().optional(),
  }),
  promptProfile: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  callback: z
    .object({
      url: z.string().url(),
      secret: z.string().optional(),
    })
    .optional(),
})

export const generateSuggestionsRequestSchema = z
  .object({
    summaryJobId: z.string().min(1).optional(),
    summaryDocumentId: z.string().min(1).optional(),
    webhookUrlOverride: z.string().url().optional(),
    promptProfile: z.string().max(2000).optional(),
    mode: z.enum(['sync', 'async']).default('async'),
  })
  .refine((value) => Boolean(value.summaryJobId || value.summaryDocumentId), {
    message: 'summaryJobId or summaryDocumentId is required',
    path: ['summaryJobId'],
  })

export const n8nSuggestionRequestPayloadSchema = z.object({
  trackingId: z.string().min(1).max(200),
  campaignId: z.string().min(1),
  sessionId: z.string().min(1),
  summary: z.object({
    content: z.string().min(1),
    hash: z.string().optional(),
    source: z.enum(['SUMMARY_DOCUMENT', 'SUMMARY_JOB_META']),
    summaryDocumentId: z.string().min(1).optional(),
    summaryJobId: z.string().min(1).optional(),
  }),
  promptProfile: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
  callback: z
    .object({
      url: z.string().url(),
      secret: z.string().optional(),
    })
    .optional(),
})

export const summaryContentSchema = z.union([
  z.string(),
  z
    .object({
      fullSummary: z.string().optional(),
      keyMoments: z.array(z.string()).optional(),
      sessionTags: z.array(z.string()).optional(),
      notableDialogue: z.array(z.string()).optional(),
      concreteFacts: z.array(z.string()).optional(),
    })
    .partial(),
])

export const summarySuggestionItemSchema = z
  .object({
    action: z.enum(['create', 'update', 'discard']).optional(),
    match: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export const summarySuggestionsSchema = z
  .object({
    session: summarySuggestionItemSchema.optional(),
    quests: z.array(summarySuggestionItemSchema).optional(),
    milestones: z.array(summarySuggestionItemSchema).optional(),
    glossary: z
      .object({
        pcs: z.array(summarySuggestionItemSchema).optional(),
        npcs: z.array(summarySuggestionItemSchema).optional(),
        items: z.array(summarySuggestionItemSchema).optional(),
        locations: z.array(summarySuggestionItemSchema).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough()

export const n8nWebhookPayloadSchema = z
  .object({
    trackingId: z.string().min(1).max(200),
    status: z.enum(['COMPLETED', 'FAILED', 'PROCESSING']).optional(),
    summaryContent: summaryContentSchema.optional(),
    suggestions: summarySuggestionsSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.summaryContent || value.suggestions), {
    message: 'summaryContent or suggestions must be provided',
    path: ['summaryContent'],
  })
  .passthrough()

export type SummarizeRequestInput = z.infer<typeof summarizeRequestSchema>
export type GenerateSuggestionsRequestInput = z.infer<typeof generateSuggestionsRequestSchema>
export type N8nWebhookPayload = z.infer<typeof n8nWebhookPayloadSchema>
export type SummaryContent = z.infer<typeof summaryContentSchema>
export type SummarySuggestions = z.infer<typeof summarySuggestionsSchema>
export type N8nRequestPayload = z.infer<typeof n8nRequestPayloadSchema>
export type N8nSuggestionRequestPayload = z.infer<typeof n8nSuggestionRequestPayloadSchema>
export type SummaryJobKind = z.infer<typeof summaryJobKindSchema>

export type SummaryJobDTO = {
  id: string
  status: string
  mode: string
  kind: SummaryJobKind
  trackingId: string
  promptProfile?: string | null
  summaryDocumentId?: string | null
  createdAt: string
  updatedAt: string
  meta?: Record<string, unknown> | null
}

export type SummarySuggestionDTO = {
  id: string
  entityType: string
  action: string
  status: string
  match?: Record<string, unknown> | null
  payload: Record<string, unknown>
}
