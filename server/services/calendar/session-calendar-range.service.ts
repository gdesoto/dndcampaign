import { prisma } from '#server/db/prisma'
import { z } from 'zod'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import {
  createSessionCalendarRangeSchema,
  type SessionCalendarRangeUpsertInput,
} from '#shared/schemas/calendar'
import type { SessionCalendarRange } from '#shared/types/calendar'
import { apiError } from '#server/utils/http'

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
  async listRanges(campaignId: string): Promise<SessionCalendarRangeDto[]> {
    const ranges = await prisma.sessionCalendarRange.findMany({
      where: { campaignId },
      orderBy: [{ startYear: 'asc' }, { startMonth: 'asc' }, { startDay: 'asc' }],
    })
    return ranges.map(toRangeDto)
  }

  async upsertRange(
    sessionId: string,
    userId: string,
    input: SessionCalendarRangeInput,
  ): Promise<SessionCalendarRangeDto> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        campaignId: true,
      },
    })

    if (!session) {
      throw apiError(404, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    const campaignAccess = await prisma.campaign.findFirst({
      where: {
        id: session.campaignId,
        ...buildCampaignWhereForPermission(userId, 'campaign.update'),
      },
      select: { id: true },
    })
    if (!campaignAccess) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
    }

    const config = await prisma.campaignCalendarConfig.findUnique({
      where: { campaignId: session.campaignId },
      select: {
        isEnabled: true,
        monthsJson: true,
      },
    })

    if (!config) {
      throw apiError(404, 'CALENDAR_CONFIG_NOT_FOUND', 'Calendar config not found for campaign.')
    }

    if (!config.isEnabled) {
      throw apiError(409, 'CALENDAR_DISABLED', 'Calendar is currently disabled for this campaign.')
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

    return toRangeDto(range)
  }

  async deleteRange(sessionId: string, userId: string): Promise<{ deleted: true }> {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    })

    if (!session) {
      throw apiError(404, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    const campaignAccess = await prisma.session.findFirst({
      where: {
        id: sessionId,
        campaign: buildCampaignWhereForPermission(userId, 'campaign.update'),
      },
      select: { id: true },
    })
    if (!campaignAccess) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
    }

    await prisma.sessionCalendarRange.deleteMany({
      where: { sessionId },
    })

    return { deleted: true }
  }
}
