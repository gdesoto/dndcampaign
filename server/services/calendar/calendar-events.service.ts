import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import {
  calendarEventCreateSchema,
  calendarEventQuerySchema,
  calendarEventUpdateSchema,
  createCalendarDateBoundsSchema,
  type CalendarEventCreateInput,
  type CalendarEventQueryInput,
  type CalendarEventUpdateInput,
} from '#shared/schemas/calendar'
import type { CampaignCalendarEvent } from '#shared/types/calendar'

type CampaignCalendarEventDto = CampaignCalendarEvent

const monthShapeSchema = z.array(z.object({ length: z.number().int().min(1) }))

const toEventDto = (row: {
  id: string
  campaignId: string
  year: number
  month: number
  day: number
  title: string
  description: string | null
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}): CampaignCalendarEventDto => ({
  id: row.id,
  campaignId: row.campaignId,
  year: row.year,
  month: row.month,
  day: row.day,
  title: row.title,
  description: row.description,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export class CalendarEventsService {
  async listEvents(
    campaignId: string,
    userId: string,
    query: CalendarEventQueryInput,
  ): Promise<ServiceResult<CampaignCalendarEventDto[]>> {
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

    const parsedQuery = calendarEventQuerySchema.parse(query)

    const events = await prisma.campaignCalendarEvent.findMany({
      where: {
        campaignId,
        ...(typeof parsedQuery.year === 'number' ? { year: parsedQuery.year } : {}),
        ...(typeof parsedQuery.month === 'number' ? { month: parsedQuery.month } : {}),
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { day: 'asc' }, { createdAt: 'asc' }],
    })

    return { ok: true, data: events.map(toEventDto) }
  }

  async createEvent(
    campaignId: string,
    userId: string,
    input: CalendarEventCreateInput,
  ): Promise<ServiceResult<CampaignCalendarEventDto>> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, 'campaign.update') },
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

    const config = await prisma.campaignCalendarConfig.findUnique({
      where: { campaignId },
      select: { isEnabled: true, monthsJson: true },
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

    const parsedInput = calendarEventCreateSchema.parse(input)
    const months = monthShapeSchema.parse(config.monthsJson)
    createCalendarDateBoundsSchema(months).parse({
      year: parsedInput.year,
      month: parsedInput.month,
      day: parsedInput.day,
    })

    const created = await prisma.campaignCalendarEvent.create({
      data: {
        campaignId,
        year: parsedInput.year,
        month: parsedInput.month,
        day: parsedInput.day,
        title: parsedInput.title,
        description: parsedInput.description,
        createdByUserId: userId,
      },
    })

    return { ok: true, data: toEventDto(created) }
  }

  async updateEvent(
    campaignId: string,
    eventId: string,
    userId: string,
    input: CalendarEventUpdateInput,
  ): Promise<ServiceResult<CampaignCalendarEventDto>> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, 'campaign.update') },
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

    const existing = await prisma.campaignCalendarEvent.findFirst({
      where: { id: eventId, campaignId },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
        message: 'Calendar event not found.',
      }
    }

    const parsedInput = calendarEventUpdateSchema.parse(input)
    const nextYear = parsedInput.year ?? existing.year
    const nextMonth = parsedInput.month ?? existing.month
    const nextDay = parsedInput.day ?? existing.day

    if (
      typeof parsedInput.year === 'number'
      || typeof parsedInput.month === 'number'
      || typeof parsedInput.day === 'number'
    ) {
      const config = await prisma.campaignCalendarConfig.findUnique({
        where: { campaignId },
        select: { isEnabled: true, monthsJson: true },
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
      createCalendarDateBoundsSchema(monthShapeSchema.parse(config.monthsJson)).parse({
        year: nextYear,
        month: nextMonth,
        day: nextDay,
      })
    }

    const updated = await prisma.campaignCalendarEvent.update({
      where: { id: existing.id },
      data: {
        ...(typeof parsedInput.year === 'number' ? { year: parsedInput.year } : {}),
        ...(typeof parsedInput.month === 'number' ? { month: parsedInput.month } : {}),
        ...(typeof parsedInput.day === 'number' ? { day: parsedInput.day } : {}),
        ...(typeof parsedInput.title === 'string' ? { title: parsedInput.title } : {}),
        ...(Object.prototype.hasOwnProperty.call(parsedInput, 'description')
          ? { description: parsedInput.description ?? null }
          : {}),
      },
    })

    return { ok: true, data: toEventDto(updated) }
  }

  async deleteEvent(
    campaignId: string,
    eventId: string,
    userId: string,
  ): Promise<ServiceResult<{ deleted: true }>> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, ...buildCampaignWhereForPermission(userId, 'campaign.update') },
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

    await prisma.campaignCalendarEvent.deleteMany({
      where: { id: eventId, campaignId },
    })

    return { ok: true, data: { deleted: true } }
  }
}
