import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ActivityLogService } from '#server/services/activity-log.service'
import { createEncounterCalendarDateSchema } from '#shared/schemas/encounter'
import type {
  EncounterCombatant,
  EncounterCondition,
  EncounterDetail,
  EncounterEvent,
  EncounterStatBlock,
  EncounterSummary,
  EncounterTemplate,
  EncounterTemplateCombatant,
} from '#shared/types/encounter'

type CampaignPermission = 'content.read' | 'content.write'

const monthShapeSchema = z.array(z.object({ length: z.number().int().min(1) }))
const activityLogService = new ActivityLogService()

export async function ensureCampaignAccess(
  campaignId: string,
  userId: string,
  permission: CampaignPermission,
): Promise<ServiceResult<{ campaignId: string }>> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ...buildCampaignWhereForPermission(userId, permission) },
    select: { id: true },
  })

  if (!campaign) {
    return {
      ok: false,
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Campaign not found or access denied.',
    }
  }

  return { ok: true, data: { campaignId: campaign.id } }
}

export async function getEncounterWithAccess(
  encounterId: string,
  userId: string,
  permission: CampaignPermission,
) {
  const encounter = await prisma.campaignEncounter.findUnique({
    where: { id: encounterId },
    select: { id: true, campaignId: true },
  })
  if (!encounter) {
    return null
  }

  const campaignAccess = await prisma.campaign.findFirst({
    where: {
      id: encounter.campaignId,
      ...buildCampaignWhereForPermission(userId, permission),
    },
    select: { id: true },
  })
  if (!campaignAccess) {
    return null
  }

  return prisma.campaignEncounter.findUnique({
    where: { id: encounterId },
    include: {
      combatants: true,
      events: { orderBy: { createdAt: 'asc' } },
      session: { select: { id: true, campaignId: true } },
    },
  })
}

export async function validateEncounterSessionLink(
  campaignId: string,
  sessionId?: string | null,
): Promise<ServiceResult<{ sessionId?: string }>> {
  if (!sessionId) {
    return { ok: true, data: {} }
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, campaignId },
    select: { id: true },
  })

  if (!session) {
    return {
      ok: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Session must belong to the same campaign.',
      fields: { sessionId: 'Session not found in this campaign.' },
    }
  }

  return { ok: true, data: { sessionId } }
}

export async function validateEncounterCalendarLink(
  campaignId: string,
  input: { calendarYear?: number | null; calendarMonth?: number | null; calendarDay?: number | null },
): Promise<ServiceResult<{ calendarYear?: number; calendarMonth?: number; calendarDay?: number }>> {
  const hasAny =
    typeof input.calendarYear === 'number'
    || typeof input.calendarMonth === 'number'
    || typeof input.calendarDay === 'number'

  if (!hasAny) {
    return { ok: true, data: {} }
  }

  const config = await prisma.campaignCalendarConfig.findUnique({
    where: { campaignId },
    select: { isEnabled: true, monthsJson: true },
  })

  if (!config || !config.isEnabled) {
    return {
      ok: false,
      statusCode: 409,
      code: 'CALENDAR_DISABLED',
      message: 'Calendar is currently disabled for this campaign.',
    }
  }

  const parsed = createEncounterCalendarDateSchema(monthShapeSchema.parse(config.monthsJson)).safeParse({
    calendarYear: input.calendarYear ?? undefined,
    calendarMonth: input.calendarMonth ?? undefined,
    calendarDay: input.calendarDay ?? undefined,
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'calendarDay'
      fieldErrors[key] = issue.message
    }
    return {
      ok: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid encounter calendar date.',
      fields: fieldErrors,
    }
  }

  return {
    ok: true,
    data: {
      calendarYear: parsed.data.calendarYear,
      calendarMonth: parsed.data.calendarMonth,
      calendarDay: parsed.data.calendarDay,
    },
  }
}

export async function validateEncounterCombatantSourceReferences(
  campaignId: string,
  input: {
    sourceType: 'CAMPAIGN_CHARACTER' | 'PLAYER_CHARACTER' | 'GLOSSARY_ENTRY' | 'CUSTOM'
    sourceCampaignCharacterId?: string | null
    sourcePlayerCharacterId?: string | null
    sourceGlossaryEntryId?: string | null
    sourceStatBlockId?: string | null
  },
): Promise<ServiceResult<{ valid: true }>> {
  const fieldErrors: Record<string, string> = {}

  if (input.sourceType === 'CAMPAIGN_CHARACTER') {
    if (!input.sourceCampaignCharacterId) {
      fieldErrors.sourceCampaignCharacterId = 'Campaign character source id is required.'
    } else {
      const exists = await prisma.campaignCharacter.findFirst({
        where: {
          campaignId,
          OR: [
            { characterId: input.sourceCampaignCharacterId },
            { id: input.sourceCampaignCharacterId },
          ],
        },
        select: { id: true },
      })
      if (!exists) {
        fieldErrors.sourceCampaignCharacterId = 'Campaign character must belong to this campaign.'
      }
    }
  }

  if (input.sourceType === 'PLAYER_CHARACTER') {
    if (!input.sourcePlayerCharacterId) {
      fieldErrors.sourcePlayerCharacterId = 'Player character source id is required.'
    } else {
      const exists = await prisma.campaignCharacter.findFirst({
        where: {
          campaignId,
          characterId: input.sourcePlayerCharacterId,
        },
        select: { id: true },
      })
      if (!exists) {
        fieldErrors.sourcePlayerCharacterId = 'Player character must be linked to this campaign.'
      }
    }
  }

  if (input.sourceType === 'GLOSSARY_ENTRY') {
    if (!input.sourceGlossaryEntryId) {
      fieldErrors.sourceGlossaryEntryId = 'Glossary entry source id is required.'
    } else {
      const exists = await prisma.glossaryEntry.findFirst({
        where: { id: input.sourceGlossaryEntryId, campaignId },
        select: { id: true },
      })
      if (!exists) {
        fieldErrors.sourceGlossaryEntryId = 'Glossary entry must belong to this campaign.'
      }
    }
  }

  if (input.sourceStatBlockId) {
    const exists = await prisma.encounterStatBlock.findFirst({
      where: { id: input.sourceStatBlockId, campaignId },
      select: { id: true },
    })
    if (!exists) {
      fieldErrors.sourceStatBlockId = 'Stat block must belong to this campaign.'
    }
  }

  if (Object.keys(fieldErrors).length) {
    return {
      ok: false,
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid combatant source references.',
      fields: fieldErrors,
    }
  }

  return { ok: true, data: { valid: true } }
}

export async function appendEncounterEvent(
  encounterId: string,
  eventType: EncounterEvent['eventType'],
  summary: string,
  payload: Record<string, unknown> | null,
  createdByUserId?: string,
) {
  await prisma.encounterEvent.create({
    data: {
      encounterId,
      eventType,
      summary,
      payload: (payload as Prisma.InputJsonValue) || undefined,
      createdByUserId,
    },
  })
}

export async function logEncounterActivity(input: {
  actorUserId: string
  campaignId: string
  action: string
  targetType: string
  targetId: string
  summary: string
  metadata?: Prisma.InputJsonValue
}) {
  await activityLogService.log({
    actorUserId: input.actorUserId,
    campaignId: input.campaignId,
    scope: 'CAMPAIGN',
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    metadata: input.metadata,
  })
}

export const toEncounterSummaryDto = (row: {
  id: string
  campaignId: string
  sessionId: string | null
  name: string
  type: EncounterSummary['type']
  status: EncounterSummary['status']
  visibility: EncounterSummary['visibility']
  currentRound: number
  currentTurnIndex: number
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}): EncounterSummary => ({
  id: row.id,
  campaignId: row.campaignId,
  sessionId: row.sessionId,
  name: row.name,
  type: row.type,
  status: row.status,
  visibility: row.visibility,
  currentRound: row.currentRound,
  currentTurnIndex: row.currentTurnIndex,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toEncounterCombatantDto = (row: {
  id: string
  encounterId: string
  name: string
  side: EncounterCombatant['side']
  sourceType: EncounterCombatant['sourceType']
  sourceCampaignCharacterId: string | null
  sourcePlayerCharacterId: string | null
  sourceGlossaryEntryId: string | null
  sourceStatBlockId: string | null
  initiative: number | null
  sortOrder: number
  maxHp: number | null
  currentHp: number | null
  tempHp: number
  armorClass: number | null
  speed: number | null
  isConcentrating: boolean
  deathSaveSuccesses: number
  deathSaveFailures: number
  isDefeated: boolean
  isHidden: boolean
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): EncounterCombatant => ({
  id: row.id,
  encounterId: row.encounterId,
  name: row.name,
  side: row.side,
  sourceType: row.sourceType,
  sourceCampaignCharacterId: row.sourceCampaignCharacterId,
  sourcePlayerCharacterId: row.sourcePlayerCharacterId,
  sourceGlossaryEntryId: row.sourceGlossaryEntryId,
  sourceStatBlockId: row.sourceStatBlockId,
  initiative: row.initiative,
  sortOrder: row.sortOrder,
  maxHp: row.maxHp,
  currentHp: row.currentHp,
  tempHp: row.tempHp,
  armorClass: row.armorClass,
  speed: row.speed,
  isConcentrating: row.isConcentrating,
  deathSaveSuccesses: row.deathSaveSuccesses,
  deathSaveFailures: row.deathSaveFailures,
  isDefeated: row.isDefeated,
  isHidden: row.isHidden,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toEncounterConditionDto = (row: {
  id: string
  combatantId: string
  name: string
  duration: number | null
  remaining: number | null
  tickTiming: EncounterCondition['tickTiming']
  source: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): EncounterCondition => ({
  id: row.id,
  combatantId: row.combatantId,
  name: row.name,
  duration: row.duration,
  remaining: row.remaining,
  tickTiming: row.tickTiming,
  source: row.source,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toEncounterEventDto = (row: {
  id: string
  encounterId: string
  eventType: EncounterEvent['eventType']
  summary: string
  payload: unknown
  createdByUserId: string | null
  createdAt: Date
}): EncounterEvent => ({
  id: row.id,
  encounterId: row.encounterId,
  eventType: row.eventType,
  summary: row.summary,
  payload: (row.payload as Record<string, unknown> | null) || null,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
})

export const toEncounterDetailDto = (
  row: {
    id: string
    campaignId: string
    sessionId: string | null
    name: string
    type: EncounterSummary['type']
    status: EncounterSummary['status']
    visibility: EncounterSummary['visibility']
    notes: string | null
    calendarYear: number | null
    calendarMonth: number | null
    calendarDay: number | null
    currentRound: number
    currentTurnIndex: number
    createdByUserId: string
    createdAt: Date
    updatedAt: Date
    combatants: Array<Parameters<typeof toEncounterCombatantDto>[0]>
    events: Array<Parameters<typeof toEncounterEventDto>[0]>
  },
  conditions: Array<Parameters<typeof toEncounterConditionDto>[0]>,
): EncounterDetail => ({
  ...toEncounterSummaryDto(row),
  notes: row.notes,
  calendarYear: row.calendarYear,
  calendarMonth: row.calendarMonth,
  calendarDay: row.calendarDay,
  combatants: row.combatants.map(toEncounterCombatantDto),
  conditions: conditions.map(toEncounterConditionDto),
  events: row.events.map(toEncounterEventDto),
})

export const toEncounterTemplateCombatantDto = (row: {
  id: string
  templateId: string
  name: string
  side: EncounterTemplateCombatant['side']
  sourceType: EncounterTemplateCombatant['sourceType']
  sourceStatBlockId: string | null
  maxHp: number | null
  armorClass: number | null
  speed: number | null
  quantity: number
  sortOrder: number
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): EncounterTemplateCombatant => ({
  id: row.id,
  templateId: row.templateId,
  name: row.name,
  side: row.side,
  sourceType: row.sourceType,
  sourceStatBlockId: row.sourceStatBlockId,
  maxHp: row.maxHp,
  armorClass: row.armorClass,
  speed: row.speed,
  quantity: row.quantity,
  sortOrder: row.sortOrder,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toEncounterTemplateDto = (row: {
  id: string
  campaignId: string
  name: string
  type: EncounterTemplate['type']
  notes: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  combatants: Array<Parameters<typeof toEncounterTemplateCombatantDto>[0]>
}): EncounterTemplate => ({
  id: row.id,
  campaignId: row.campaignId,
  name: row.name,
  type: row.type,
  notes: row.notes,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  combatants: row.combatants.map(toEncounterTemplateCombatantDto),
})

export const toEncounterStatBlockDto = (row: {
  id: string
  campaignId: string
  name: string
  challengeRating: string | null
  statBlockJson: unknown
  notes: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}): EncounterStatBlock => ({
  id: row.id,
  campaignId: row.campaignId,
  name: row.name,
  challengeRating: row.challengeRating,
  statBlockJson: row.statBlockJson as Record<string, unknown>,
  notes: row.notes,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

