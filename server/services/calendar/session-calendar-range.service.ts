import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, asc } from 'drizzle-orm'
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
    const ranges = await db.query.sessionCalendarRange.findMany({
      where: eq(tables.sessionCalendarRange.campaignId, campaignId),
      orderBy: [asc(tables.sessionCalendarRange.startYear), asc(tables.sessionCalendarRange.startMonth), asc(tables.sessionCalendarRange.startDay)],
    })
    return ranges.map(toRangeDto)
  }

  async upsertRange(
    sessionId: string,
    userId: string,
    input: SessionCalendarRangeInput,
  ): Promise<SessionCalendarRangeDto> {
    const session = await db.query.session.findFirst({
      where: eq(tables.session.id, sessionId),
      columns: { id: true, campaignId: true },
    })

    if (!session) {
      throw apiError(404, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    const campaignAccess = await db.query.campaign.findFirst({
      where: and(
        eq(tables.campaign.id, session.campaignId),
        buildCampaignWhereForPermission(userId, 'campaign.update'),
      ),
      columns: { id: true },
    })
    if (!campaignAccess) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
    }

    const config = await db.query.campaignCalendarConfig.findFirst({
      where: eq(tables.campaignCalendarConfig.campaignId, session.campaignId),
      columns: { isEnabled: true, monthsJson: true },
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

    const range = await db.insert(tables.sessionCalendarRange).values({
      sessionId,
      campaignId: session.campaignId,
      startYear: parsedInput.startYear,
      startMonth: parsedInput.startMonth,
      startDay: parsedInput.startDay,
      endYear: parsedInput.endYear,
      endMonth: parsedInput.endMonth,
      endDay: parsedInput.endDay,
    }).onConflictDoUpdate({ target: [tables.sessionCalendarRange.sessionId], set: {
        startYear: parsedInput.startYear,
        startMonth: parsedInput.startMonth,
        startDay: parsedInput.startDay,
        endYear: parsedInput.endYear,
        endMonth: parsedInput.endMonth,
        endDay: parsedInput.endDay,
      } }).returning().get()

    return toRangeDto(range)
  }

  async deleteRange(sessionId: string, userId: string): Promise<{ deleted: true }> {
    const session = await db.query.session.findFirst({
      where: eq(tables.session.id, sessionId),
      columns: { id: true },
    })

    if (!session) {
      throw apiError(404, 'SESSION_NOT_FOUND', 'Session not found.')
    }

    const campaignAccess = await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(userId, 'campaign.update', tables.session.campaignId),
      ),
      columns: { id: true },
    })
    if (!campaignAccess) {
      throw apiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
    }

    await db.delete(tables.sessionCalendarRange).where(eq(tables.sessionCalendarRange.sessionId, sessionId)).run()

    return { deleted: true }
  }
}
