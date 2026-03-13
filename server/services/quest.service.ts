import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import type {
  questSourceTypeSchema,
  questTrackSchema,
  questTypeSchema,
  QuestCreateInput,
  QuestUpdateInput,
} from '#shared/schemas/quest'
import { validateCalendarDateBounds } from '#shared/schemas/calendar'

type QuestType = z.infer<typeof questTypeSchema>
type QuestTrack = z.infer<typeof questTrackSchema>
type QuestSourceType = z.infer<typeof questSourceTypeSchema>

type QuestExpirationDateDto = {
  year: number
  month: number
  day: number
} | null

type QuestDto = {
  id: string
  campaignId: string
  title: string
  description: string | null
  type: QuestType
  track: QuestTrack
  sourceType: QuestSourceType
  sourceText: string | null
  sourceNpcId: string | null
  sourceNpcName: string | null
  sourceCharacterId: string | null
  sourceCharacterName: string | null
  reward: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes: string | null
  expirationDate: QuestExpirationDateDto
  sortOrder: number
  createdAt: string
  updatedAt: string
}

const questSourceTypeByQuestType: Record<QuestType, QuestSourceType[]> = {
  CAMPAIGN: ['FREE_TEXT', 'NPC'],
  GUILD: ['FREE_TEXT'],
  CHARACTER: ['FREE_TEXT', 'CAMPAIGN_CHARACTER'],
}

const monthShapeSchema = z.array(z.object({ length: z.number().int().min(1) }))

const toQuestDto = (row: {
  id: string
  campaignId: string
  title: string
  description: string | null
  type: QuestType
  track: QuestTrack
  sourceType: QuestSourceType
  sourceText: string | null
  sourceNpcId: string | null
  sourceNpc?: { name: string } | null
  sourceCharacterId: string | null
  sourceCharacter?: { name: string } | null
  reward: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes: string | null
  expirationYear: number | null
  expirationMonth: number | null
  expirationDay: number | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): QuestDto => ({
  id: row.id,
  campaignId: row.campaignId,
  title: row.title,
  description: row.description,
  type: row.type,
  track: row.track,
  sourceType: row.sourceType,
  sourceText: row.sourceText,
  sourceNpcId: row.sourceNpcId,
  sourceNpcName: row.sourceNpc?.name || null,
  sourceCharacterId: row.sourceCharacterId,
  sourceCharacterName: row.sourceCharacter?.name || null,
  reward: row.reward,
  status: row.status,
  progressNotes: row.progressNotes,
  expirationDate:
    row.expirationYear !== null && row.expirationMonth !== null && row.expirationDay !== null
      ? {
          year: row.expirationYear,
          month: row.expirationMonth,
          day: row.expirationDay,
        }
      : null,
  sortOrder: row.sortOrder,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const toExpirationParts = (value: QuestExpirationDateDto | undefined) => {
  if (value === undefined) return undefined
  if (value === null) {
    return {
      expirationYear: null,
      expirationMonth: null,
      expirationDay: null,
    }
  }

  return {
    expirationYear: value.year,
    expirationMonth: value.month,
    expirationDay: value.day,
  }
}

export class QuestService {
  async listCampaignQuests(campaignId: string): Promise<QuestDto[]> {
    const rows = await prisma.quest.findMany({
      where: { campaignId },
      include: {
        sourceNpc: {
          select: { name: true },
        },
        sourceCharacter: {
          select: { name: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    })

    return rows.map(toQuestDto)
  }

  async createQuest(campaignId: string, input: QuestCreateInput): Promise<ServiceResult<QuestDto>> {
    const validation = await this.validateQuestInput(campaignId, input, { validateExpiration: true })
    if (!validation.ok) return validation

    const created = await prisma.quest.create({
      data: {
        campaignId,
        title: input.title,
        description: normalizeOptionalText(input.description) ?? null,
        type: validation.data.type,
        track: validation.data.track,
        sourceType: validation.data.sourceType,
        sourceText: validation.data.sourceText,
        sourceNpcId: validation.data.sourceNpcId,
        sourceCharacterId: validation.data.sourceCharacterId,
        reward: normalizeOptionalText(input.reward) ?? null,
        status: input.status || 'ACTIVE',
        progressNotes: normalizeOptionalText(input.progressNotes) ?? null,
        expirationYear: validation.data.expirationYear,
        expirationMonth: validation.data.expirationMonth,
        expirationDay: validation.data.expirationDay,
      },
      include: {
        sourceNpc: {
          select: { name: true },
        },
        sourceCharacter: {
          select: { name: true },
        },
      },
    })

    return { ok: true, data: toQuestDto(created) }
  }

  async updateQuest(
    questId: string,
    input: QuestUpdateInput,
  ): Promise<ServiceResult<QuestDto>> {
    const existing = await prisma.quest.findUnique({
      where: { id: questId },
      select: {
        id: true,
        campaignId: true,
        title: true,
        description: true,
        type: true,
        track: true,
        sourceType: true,
        sourceText: true,
        sourceNpcId: true,
        sourceCharacterId: true,
        reward: true,
        status: true,
        progressNotes: true,
        expirationYear: true,
        expirationMonth: true,
        expirationDay: true,
      },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Quest not found.',
      }
    }

    const mergedInput: QuestCreateInput = {
      title: input.title ?? existing.title,
      description: input.description === undefined ? existing.description || undefined : input.description || undefined,
      type: input.type ?? existing.type,
      track: input.track ?? existing.track,
      sourceType: input.sourceType ?? existing.sourceType,
      sourceText:
        input.sourceText === undefined
          ? existing.sourceText || undefined
          : input.sourceText || undefined,
      sourceNpcId:
        input.sourceNpcId === undefined
          ? existing.sourceNpcId || undefined
          : input.sourceNpcId || undefined,
      sourceCharacterId:
        input.sourceCharacterId === undefined
          ? existing.sourceCharacterId || undefined
          : input.sourceCharacterId || undefined,
      reward: input.reward === undefined ? existing.reward || undefined : input.reward || undefined,
      status: input.status ?? existing.status,
      progressNotes: input.progressNotes === undefined ? existing.progressNotes || undefined : input.progressNotes || undefined,
      expirationDate:
        input.expirationDate === undefined
          ? (
              existing.expirationYear !== null
                && existing.expirationMonth !== null
                && existing.expirationDay !== null
                ? {
                    year: existing.expirationYear,
                    month: existing.expirationMonth,
                    day: existing.expirationDay,
                  }
                : undefined
            )
          : input.expirationDate || undefined,
    }

    const validation = await this.validateQuestInput(existing.campaignId, mergedInput, {
      validateExpiration: input.expirationDate !== undefined,
    })
    if (!validation.ok) return validation

    const updated = await prisma.quest.update({
      where: { id: questId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: normalizeOptionalText(input.description) } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.track !== undefined ? { track: input.track } : {}),
        ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
        ...(input.sourceText !== undefined ? { sourceText: normalizeOptionalText(input.sourceText) } : {}),
        ...(input.sourceNpcId !== undefined ? { sourceNpcId: input.sourceNpcId } : {}),
        ...(input.sourceCharacterId !== undefined ? { sourceCharacterId: input.sourceCharacterId } : {}),
        ...(input.reward !== undefined ? { reward: normalizeOptionalText(input.reward) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.progressNotes !== undefined ? { progressNotes: normalizeOptionalText(input.progressNotes) } : {}),
        ...(input.expirationDate !== undefined ? toExpirationParts(input.expirationDate) : {}),
      },
      include: {
        sourceNpc: {
          select: { name: true },
        },
        sourceCharacter: {
          select: { name: true },
        },
      },
    })

    return { ok: true, data: toQuestDto(updated) }
  }

  private async validateQuestInput(
    campaignId: string,
    input: Pick<QuestCreateInput, 'type' | 'track' | 'sourceType' | 'sourceText' | 'sourceNpcId' | 'sourceCharacterId' | 'expirationDate'>,
    options: {
      validateExpiration: boolean
    },
  ): Promise<ServiceResult<{
    campaignId: string
    type: QuestType
    track: QuestTrack
    sourceType: QuestSourceType
    sourceText: string | null
    sourceNpcId: string | null
    sourceCharacterId: string | null
    expirationYear: number | null
    expirationMonth: number | null
    expirationDay: number | null
  }>> {
    const type = input.type || 'CAMPAIGN'
    const track = input.track || 'SIDE'
    const sourceType = input.sourceType || 'FREE_TEXT'
    const sourceText = normalizeOptionalText(input.sourceText)
    const sourceNpcId = input.sourceNpcId || null
    const sourceCharacterId = input.sourceCharacterId || null
    const expirationDate = input.expirationDate === undefined ? null : input.expirationDate

    if (!questSourceTypeByQuestType[type].includes(sourceType)) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Selected source is not valid for this quest type.',
        fields: { sourceType: 'Selected source is not valid for this quest type.' },
      }
    }

    if (sourceType === 'FREE_TEXT' && !sourceText) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Source text is required for free text sources.',
        fields: { sourceText: 'Source text is required for free text sources.' },
      }
    }

    if (sourceType !== 'FREE_TEXT' && sourceText) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Source text is only allowed for free text sources.',
        fields: { sourceText: 'Source text is only allowed for free text sources.' },
      }
    }

    if (sourceType === 'NPC') {
      const npc = await prisma.glossaryEntry.findFirst({
        where: {
          id: sourceNpcId || '__missing__',
          campaignId,
          type: 'NPC',
        },
        select: { id: true },
      })

      if (!npc) {
        return {
          ok: false,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Selected NPC source was not found in this campaign.',
          fields: { sourceNpcId: 'Selected NPC source was not found in this campaign.' },
        }
      }
    }

    if (sourceType !== 'NPC' && sourceNpcId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'NPC source selection is only allowed for NPC sources.',
        fields: { sourceNpcId: 'NPC source selection is only allowed for NPC sources.' },
      }
    }

    if (sourceType === 'CAMPAIGN_CHARACTER') {
      const characterLink = await prisma.campaignCharacter.findFirst({
        where: {
          campaignId,
          characterId: sourceCharacterId || '__missing__',
        },
        select: { id: true },
      })

      if (!characterLink) {
        return {
          ok: false,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Selected campaign character source was not found in this campaign.',
          fields: { sourceCharacterId: 'Selected campaign character source was not found in this campaign.' },
        }
      }
    }

    if (sourceType !== 'CAMPAIGN_CHARACTER' && sourceCharacterId) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Campaign character selection is only allowed for campaign character sources.',
        fields: { sourceCharacterId: 'Campaign character selection is only allowed for campaign character sources.' },
      }
    }

    if (options.validateExpiration && expirationDate) {
      const calendarConfig = await prisma.campaignCalendarConfig.findUnique({
        where: { campaignId },
        select: {
          isEnabled: true,
          monthsJson: true,
        },
      })

      if (!calendarConfig?.isEnabled) {
        return {
          ok: false,
          statusCode: 409,
          code: 'CALENDAR_DISABLED',
          message: 'Enable the campaign calendar before setting quest expiration dates.',
          fields: { expirationDate: 'Enable the campaign calendar before setting quest expiration dates.' },
        }
      }

      const months = monthShapeSchema.parse(calendarConfig.monthsJson)
      if (!validateCalendarDateBounds(expirationDate, months)) {
        return {
          ok: false,
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: 'Expiration date is outside the configured campaign calendar.',
          fields: { expirationDate: 'Expiration date is outside the configured campaign calendar.' },
        }
      }
    }

    return {
      ok: true,
      data: {
        campaignId,
        type,
        track,
        sourceType,
        sourceText: sourceType === 'FREE_TEXT' ? (sourceText ?? null) : null,
        sourceNpcId: sourceType === 'NPC' ? sourceNpcId : null,
        sourceCharacterId: sourceType === 'CAMPAIGN_CHARACTER' ? sourceCharacterId : null,
        expirationYear: expirationDate?.year ?? null,
        expirationMonth: expirationDate?.month ?? null,
        expirationDay: expirationDate?.day ?? null,
      },
    }
  }
}

export type { QuestDto, QuestExpirationDateDto }
