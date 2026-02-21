import { prisma } from '#server/db/prisma'
import { z } from 'zod'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import {
  createSessionCalendarRangeSchema,
  type SessionCalendarRangeUpsertInput,
} from '#shared/schemas/calendar'
import type { SessionCalendarRange } from '#shared/types/calendar'

type SessionCalendarRangeDto = SessionCalendarRange
const monthShapeSchema = z.array(z.object({ length: z.number().int().min(1) }))

type SessionCalendarRangeInput = {
  startYear: number
  startMonth: number
  startDay: number
  endYear?: number
  endMonth?: number
  endDay?: number
}

const toRangeDto = (row: {
  id: string
  sessionId: string
  campaignId: string
  startYear: number
  startMonth: number
  startDay: number
  endYear: number
  endMonth: number
  endDay: number
  createdAt: Date
  updatedAt: Date
}): SessionCalendarRangeDto => ({
  id: row.id,
  sessionId: row.sessionId,
  campaignId: row.campaignId,
  startYear: row.startYear,
  startMonth: row.startMonth,
  startDay: row.startDay,
  endYear: row.endYear,
  endMonth: row.endMonth,
  endDay: row.endDay,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const normalizeRangeInput = (input: SessionCalendarRangeInput): SessionCalendarRangeUpsertInput => ({
  startYear: input.startYear,
  startMonth: input.startMonth,
  startDay: input.startDay,
  endYear: input.endYear ?? input.startYear,
  endMonth: input.endMonth ?? input.startMonth,
  endDay: input.endDay ?? input.startDay,
})

export class SessionCalendarRangeService {
  async listRanges(campaignId: string, userId: string): Promise<ServiceResult<SessionCalendarRangeDto[]>> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, 'campaign.read') },
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

    const ranges = await prisma.sessionCalendarRange.findMany({
      where: { campaignId },
      orderBy: [{ startYear: 'asc' }, { startMonth: 'asc' }, { startDay: 'asc' }],
    })
    return { ok: true, data: ranges.map(toRangeDto) }
  }

  async upsertRange(
    sessionId: string,
    userId: string,
    input: SessionCalendarRangeInput,
  ): Promise<ServiceResult<SessionCalendarRangeDto>> {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        campaign: buildCampaignWhereForPermission(userId, 'campaign.update'),
      },
      select: {
        id: true,
        campaignId: true,
      },
    })

    if (!session) {
      return {
        ok: false,
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found or access denied.',
      }
    }

    const config = await prisma.campaignCalendarConfig.findUnique({
      where: { campaignId: session.campaignId },
      select: {
        isEnabled: true,
        monthsJson: true,
      },
    })

    if (!config) {
      return {
        ok: false,
        statusCode: 404,
        code: 'CALENDAR_CONFIG_NOT_FOUND',
        message: 'Calendar config not found for campaign.',
      }
    }

    if (!config.isEnabled) {
      return {
        ok: false,
        statusCode: 409,
        code: 'CALENDAR_DISABLED',
        message: 'Calendar is currently disabled for this campaign.',
      }
    }

    const parsedInput = createSessionCalendarRangeSchema(monthShapeSchema.parse(config.monthsJson)).parse(
      normalizeRangeInput(input),
    )

    const range = await prisma.sessionCalendarRange.upsert({
      where: { sessionId },
      create: {
        sessionId,
        campaignId: session.campaignId,
        startYear: parsedInput.startYear,
        startMonth: parsedInput.startMonth,
        startDay: parsedInput.startDay,
        endYear: parsedInput.endYear,
        endMonth: parsedInput.endMonth,
        endDay: parsedInput.endDay,
      },
      update: {
        startYear: parsedInput.startYear,
        startMonth: parsedInput.startMonth,
        startDay: parsedInput.startDay,
        endYear: parsedInput.endYear,
        endMonth: parsedInput.endMonth,
        endDay: parsedInput.endDay,
      },
    })

    return { ok: true, data: toRangeDto(range) }
  }

  async deleteRange(sessionId: string, userId: string): Promise<ServiceResult<{ deleted: true }>> {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        campaign: buildCampaignWhereForPermission(userId, 'campaign.update'),
      },
      select: { id: true },
    })

    if (!session) {
      return {
        ok: false,
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found or access denied.',
      }
    }

    await prisma.sessionCalendarRange.deleteMany({
      where: { sessionId },
    })

    return { ok: true, data: { deleted: true } }
  }
}
