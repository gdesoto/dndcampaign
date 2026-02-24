import { z } from 'zod'
import { createCalendarDateBoundsSchema } from './calendar'

export const encounterStatusSchema = z.enum(['PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED'])
export const encounterTypeSchema = z.enum(['COMBAT', 'SOCIAL', 'SKILL_CHALLENGE', 'CHASE', 'HAZARD'])
export const encounterVisibilitySchema = z.enum(['DM_ONLY', 'SHARED'])
export const encounterSideSchema = z.enum(['ALLY', 'ENEMY', 'NEUTRAL'])
export const encounterSourceTypeSchema = z.enum(['CAMPAIGN_CHARACTER', 'PLAYER_CHARACTER', 'GLOSSARY_ENTRY', 'CUSTOM'])
export const conditionTickTimingSchema = z.enum(['TURN_START', 'TURN_END', 'ROUND_END'])
export const encounterEventTypeSchema = z.enum(['ENCOUNTER', 'TURN', 'HP', 'CONDITION', 'NOTE', 'SYSTEM'])

const stateOrder: Record<z.infer<typeof encounterStatusSchema>, number> = {
  PLANNED: 0,
  ACTIVE: 1,
  PAUSED: 2,
  COMPLETED: 3,
  ABANDONED: 4,
}

export const encounterListQuerySchema = z.object({
  status: encounterStatusSchema.optional(),
  type: encounterTypeSchema.optional(),
  sessionId: z.string().min(1).optional(),
})

export const encounterCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: encounterTypeSchema.default('COMBAT'),
  visibility: encounterVisibilitySchema.default('SHARED'),
  notes: z.string().max(10000).optional(),
  sessionId: z.string().min(1).optional(),
  calendarYear: z.number().int().optional(),
  calendarMonth: z.number().int().positive().optional(),
  calendarDay: z.number().int().positive().optional(),
})

export const encounterUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: encounterTypeSchema.optional(),
  visibility: encounterVisibilitySchema.optional(),
  notes: z.string().max(10000).optional().nullable(),
  sessionId: z.string().min(1).optional().nullable(),
  status: encounterStatusSchema.optional(),
  calendarYear: z.number().int().optional().nullable(),
  calendarMonth: z.number().int().positive().optional().nullable(),
  calendarDay: z.number().int().positive().optional().nullable(),
  currentRound: z.number().int().min(1).optional(),
  currentTurnIndex: z.number().int().min(0).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
  path: ['name'],
})

export const encounterStatusTransitionSchema = z.object({
  from: encounterStatusSchema,
  to: encounterStatusSchema,
}).superRefine((value, ctx) => {
  if (value.from === value.to) return
  const fromOrder = stateOrder[value.from]
  const toOrder = stateOrder[value.to]
  if (toOrder < fromOrder && !(value.from === 'PAUSED' && value.to === 'ACTIVE')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['to'],
      message: `Invalid transition from ${value.from} to ${value.to}`,
    })
  }
})

export const encounterCombatantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  side: encounterSideSchema.default('ENEMY'),
  sourceType: encounterSourceTypeSchema.default('CUSTOM'),
  sourceCampaignCharacterId: z.string().optional(),
  sourcePlayerCharacterId: z.string().optional(),
  sourceGlossaryEntryId: z.string().optional(),
  sourceStatBlockId: z.string().optional(),
  initiative: z.number().int().optional(),
  maxHp: z.number().int().min(0).optional(),
  currentHp: z.number().int().min(0).optional(),
  tempHp: z.number().int().min(0).default(0),
  armorClass: z.number().int().min(0).optional(),
  speed: z.number().int().min(0).optional(),
  isHidden: z.boolean().default(false),
  notes: z.string().max(5000).optional(),
})

export const encounterCombatantUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  side: encounterSideSchema.optional(),
  sourceType: encounterSourceTypeSchema.optional(),
  sourceStatBlockId: z.string().optional().nullable(),
  initiative: z.number().int().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(0).optional().nullable(),
  currentHp: z.number().int().min(0).optional().nullable(),
  tempHp: z.number().int().min(0).optional(),
  armorClass: z.number().int().min(0).optional().nullable(),
  speed: z.number().int().min(0).optional().nullable(),
  isConcentrating: z.boolean().optional(),
  deathSaveSuccesses: z.number().int().min(0).max(3).optional(),
  deathSaveFailures: z.number().int().min(0).max(3).optional(),
  isDefeated: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
  path: ['name'],
})

export const encounterDamageSchema = z.object({
  amount: z.number().int().min(1).max(9999),
  note: z.string().max(500).optional(),
})

export const encounterHealSchema = z.object({
  amount: z.number().int().min(1).max(9999),
  note: z.string().max(500).optional(),
})

export const encounterConditionCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  duration: z.number().int().min(0).optional(),
  remaining: z.number().int().min(0).optional(),
  tickTiming: conditionTickTimingSchema.default('TURN_END'),
  source: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
})

export const encounterConditionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  duration: z.number().int().min(0).optional().nullable(),
  remaining: z.number().int().min(0).optional().nullable(),
  tickTiming: conditionTickTimingSchema.optional(),
  source: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
  path: ['name'],
})

export const encounterEventNoteCreateSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const encounterInitiativeReorderSchema = z.object({
  combatantOrder: z.array(z.string().min(1)).min(1),
})

export const encounterInitiativeRollSchema = z.object({
  mode: z.enum(['ALL', 'UNSET', 'NON_PCS']).default('ALL'),
})

export const encounterSetActiveTurnSchema = z.object({
  combatantId: z.string().min(1),
})

export const encounterTemplateCombatantCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  side: encounterSideSchema.default('ENEMY'),
  sourceType: encounterSourceTypeSchema.default('CUSTOM'),
  sourceStatBlockId: z.string().optional(),
  maxHp: z.number().int().min(0).optional(),
  armorClass: z.number().int().min(0).optional(),
  speed: z.number().int().min(0).optional(),
  quantity: z.number().int().min(1).max(50).default(1),
  sortOrder: z.number().int().min(0),
  notes: z.string().max(5000).optional(),
})

export const encounterTemplateCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: encounterTypeSchema.default('COMBAT'),
  notes: z.string().max(10000).optional(),
  combatants: z.array(encounterTemplateCombatantCreateSchema).default([]),
})

export const encounterTemplateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: encounterTypeSchema.optional(),
  notes: z.string().max(10000).optional().nullable(),
  combatants: z.array(encounterTemplateCombatantCreateSchema).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
  path: ['name'],
})

export const encounterTemplateInstantiateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sessionId: z.string().min(1).optional(),
  calendarYear: z.number().int().optional(),
  calendarMonth: z.number().int().positive().optional(),
  calendarDay: z.number().int().positive().optional(),
})

export const encounterStatBlockCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  challengeRating: z.string().max(40).optional(),
  statBlockJson: z.record(z.string(), z.unknown()),
  notes: z.string().max(10000).optional(),
})

export const encounterStatBlockUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  challengeRating: z.string().max(40).optional().nullable(),
  statBlockJson: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(10000).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
  path: ['name'],
})

export const createEncounterCalendarDateSchema = (months: Array<{ length: number }>) =>
  z
    .object({
      calendarYear: z.number().int().optional(),
      calendarMonth: z.number().int().positive().optional(),
      calendarDay: z.number().int().positive().optional(),
    })
    .superRefine((value, ctx) => {
      const hasAny =
        typeof value.calendarYear === 'number'
        || typeof value.calendarMonth === 'number'
        || typeof value.calendarDay === 'number'

      if (!hasAny) return

      if (
        typeof value.calendarYear !== 'number'
        || typeof value.calendarMonth !== 'number'
        || typeof value.calendarDay !== 'number'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['calendarDay'],
          message: 'Calendar year, month, and day must all be provided together.',
        })
        return
      }

      const parsedDate = createCalendarDateBoundsSchema(months).safeParse({
        year: value.calendarYear,
        month: value.calendarMonth,
        day: value.calendarDay,
      })
      if (!parsedDate.success) {
        for (const issue of parsedDate.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['calendarDay'],
            message: issue.message,
          })
        }
      }
    })

export type EncounterListQueryInput = z.infer<typeof encounterListQuerySchema>
export type EncounterCreateInput = z.infer<typeof encounterCreateSchema>
export type EncounterUpdateInput = z.infer<typeof encounterUpdateSchema>
export type EncounterCombatantCreateInput = z.infer<typeof encounterCombatantCreateSchema>
export type EncounterCombatantUpdateInput = z.infer<typeof encounterCombatantUpdateSchema>
export type EncounterDamageInput = z.infer<typeof encounterDamageSchema>
export type EncounterHealInput = z.infer<typeof encounterHealSchema>
export type EncounterConditionCreateInput = z.infer<typeof encounterConditionCreateSchema>
export type EncounterConditionUpdateInput = z.infer<typeof encounterConditionUpdateSchema>
export type EncounterEventNoteCreateInput = z.infer<typeof encounterEventNoteCreateSchema>
export type EncounterInitiativeReorderInput = z.infer<typeof encounterInitiativeReorderSchema>
export type EncounterInitiativeRollInput = z.infer<typeof encounterInitiativeRollSchema>
export type EncounterSetActiveTurnInput = z.infer<typeof encounterSetActiveTurnSchema>
export type EncounterTemplateCreateInput = z.infer<typeof encounterTemplateCreateSchema>
export type EncounterTemplateUpdateInput = z.infer<typeof encounterTemplateUpdateSchema>
export type EncounterTemplateInstantiateInput = z.infer<typeof encounterTemplateInstantiateSchema>
export type EncounterStatBlockCreateInput = z.infer<typeof encounterStatBlockCreateSchema>
export type EncounterStatBlockUpdateInput = z.infer<typeof encounterStatBlockUpdateSchema>
