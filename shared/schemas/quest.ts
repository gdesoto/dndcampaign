import { z } from 'zod'
import { calendarDateSchema } from './calendar'

export const questStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'FAILED', 'ON_HOLD'])
export const questTypeSchema = z.enum(['CAMPAIGN', 'GUILD', 'CHARACTER'])
export const questTrackSchema = z.enum(['MAIN', 'SIDE'])
export const questSourceTypeSchema = z.enum(['FREE_TEXT', 'NPC', 'CAMPAIGN_CHARACTER'])

const optionalQuestTextSchema = z.string().trim().max(10000).optional()
const nullableQuestTextSchema = z.string().trim().max(10000).optional().nullable()

const questExpirationDateSchema = calendarDateSchema
const optionalQuestExpirationDateSchema = questExpirationDateSchema.optional()
const nullableQuestExpirationDateSchema = questExpirationDateSchema.optional().nullable()

const validateQuestSource = (
  value: {
    type?: z.infer<typeof questTypeSchema>
    sourceType?: z.infer<typeof questSourceTypeSchema>
    sourceText?: string | null
    sourceNpcId?: string | null
    sourceCharacterId?: string | null
    expirationDate?: { year: number, month: number, day: number } | null
  },
  ctx: z.RefinementCtx,
) => {
  if (!value.type || !value.sourceType) return

  const sourceTypeByQuestType: Record<z.infer<typeof questTypeSchema>, Array<z.infer<typeof questSourceTypeSchema>>> = {
    CAMPAIGN: ['FREE_TEXT', 'NPC'],
    GUILD: ['FREE_TEXT'],
    CHARACTER: ['FREE_TEXT', 'CAMPAIGN_CHARACTER'],
  }

  if (!sourceTypeByQuestType[value.type].includes(value.sourceType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceType'],
      message: 'Selected source is not valid for this quest type',
    })
  }

  if (value.sourceType === 'FREE_TEXT' && !value.sourceText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceText'],
      message: 'Source text is required for free text sources',
    })
  }

  if (value.sourceType !== 'FREE_TEXT' && value.sourceText && value.sourceText.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceText'],
      message: 'Source text is only allowed for free text sources',
    })
  }

  if (value.sourceType === 'NPC' && !value.sourceNpcId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceNpcId'],
      message: 'NPC source selection is required',
    })
  }

  if (value.sourceType !== 'NPC' && value.sourceNpcId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceNpcId'],
      message: 'NPC source selection is only allowed for NPC sources',
    })
  }

  if (value.sourceType === 'CAMPAIGN_CHARACTER' && !value.sourceCharacterId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceCharacterId'],
      message: 'Campaign character source selection is required',
    })
  }

  if (value.sourceType !== 'CAMPAIGN_CHARACTER' && value.sourceCharacterId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceCharacterId'],
      message: 'Campaign character source selection is only allowed for campaign character sources',
    })
  }

  if (
    value.expirationDate
    && (
      value.expirationDate.year === undefined
      || value.expirationDate.month === undefined
      || value.expirationDate.day === undefined
    )
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expirationDate'],
      message: 'Expiration date must include year, month, and day',
    })
  }
}

export const questCreateSchema = z.object({
  title: z.string().min(2).max(200),
  description: optionalQuestTextSchema,
  type: questTypeSchema.optional(),
  track: questTrackSchema.optional(),
  sourceType: questSourceTypeSchema.optional(),
  sourceText: optionalQuestTextSchema,
  sourceNpcId: z.string().uuid().optional(),
  sourceCharacterId: z.string().uuid().optional(),
  reward: optionalQuestTextSchema,
  status: questStatusSchema.optional(),
  progressNotes: optionalQuestTextSchema,
  expirationDate: optionalQuestExpirationDateSchema,
}).superRefine(validateQuestSource)

export const questUpdateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: nullableQuestTextSchema,
  type: questTypeSchema.optional(),
  track: questTrackSchema.optional(),
  sourceType: questSourceTypeSchema.optional(),
  sourceText: nullableQuestTextSchema,
  sourceNpcId: z.string().uuid().optional().nullable(),
  sourceCharacterId: z.string().uuid().optional().nullable(),
  reward: nullableQuestTextSchema,
  status: questStatusSchema.optional(),
  progressNotes: nullableQuestTextSchema,
  expirationDate: nullableQuestExpirationDateSchema,
}).superRefine(validateQuestSource)

export type QuestCreateInput = z.infer<typeof questCreateSchema>
export type QuestUpdateInput = z.infer<typeof questUpdateSchema>
