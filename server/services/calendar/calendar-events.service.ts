import { z } from 'zod'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, asc } from 'drizzle-orm'
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
import { apiError } from '#server/utils/http'

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
  async listEvents(campaignId: string, query: CalendarEventQueryInput): Promise<CampaignCalendarEventDto[]> {
    const parsedQuery = calendarEventQuerySchema.parse(query)

    const events = await db.query.campaignCalendarEvent.findMany({
      where: and(
        eq(tables.campaignCalendarEvent.campaignId, campaignId),
        typeof parsedQuery.year === 'number' ? eq(tables.campaignCalendarEvent.year, parsedQuery.year) : undefined,
        typeof parsedQuery.month === 'number' ? eq(tables.campaignCalendarEvent.month, parsedQuery.month) : undefined,
      ),
      orderBy: [asc(tables.campaignCalendarEvent.year), asc(tables.campaignCalendarEvent.month), asc(tables.campaignCalendarEvent.day), asc(tables.campaignCalendarEvent.createdAt)],
    })

    return events.map(toEventDto)
  }

  async createEvent(
    campaignId: string,
    userId: string,
    input: CalendarEventCreateInput,
  ): Promise<CampaignCalendarEventDto> {
    const config = await db.query.campaignCalendarConfig.findFirst({
      where: eq(tables.campaignCalendarConfig.campaignId, campaignId),
      columns: { isEnabled: true, monthsJson: true },
    })

    if (!config) {
      throw apiError(404, 'CALENDAR_CONFIG_NOT_FOUND', 'Calendar config not found for campaign.')
    }

    if (!config.isEnabled) {
      throw apiError(409, 'CALENDAR_DISABLED', 'Calendar is currently disabled for this campaign.')
    }

    const parsedInput = calendarEventCreateSchema.parse(input)
    const months = monthShapeSchema.parse(config.monthsJson)
    createCalendarDateBoundsSchema(months).parse({
      year: parsedInput.year,
      month: parsedInput.month,
      day: parsedInput.day,
    })

    const created = await db.insert(tables.campaignCalendarEvent).values({
      campaignId,
      year: parsedInput.year,
      month: parsedInput.month,
      day: parsedInput.day,
      title: parsedInput.title,
      description: parsedInput.description,
      createdByUserId: userId,
    }).returning().get()

    return toEventDto(created)
  }

  async updateEvent(
    campaignId: string,
    eventId: string,
    input: CalendarEventUpdateInput,
  ): Promise<CampaignCalendarEventDto> {
    const existing = await db.query.campaignCalendarEvent.findFirst({
      where: and(
        eq(tables.campaignCalendarEvent.id, eventId),
        eq(tables.campaignCalendarEvent.campaignId, campaignId),
      ),
    })

    if (!existing) {
      throw apiError(404, 'EVENT_NOT_FOUND', 'Calendar event not found.')
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
      const config = await db.query.campaignCalendarConfig.findFirst({
        where: eq(tables.campaignCalendarConfig.campaignId, campaignId),
        columns: { isEnabled: true, monthsJson: true },
      })
      if (!config) {
        throw apiError(404, 'CALENDAR_CONFIG_NOT_FOUND', 'Calendar config not found for campaign.')
      }
      if (!config.isEnabled) {
        throw apiError(409, 'CALENDAR_DISABLED', 'Calendar is currently disabled for this campaign.')
      }
      createCalendarDateBoundsSchema(monthShapeSchema.parse(config.monthsJson)).parse({
        year: nextYear,
        month: nextMonth,
        day: nextDay,
      })
    }

    const updated = await db.update(tables.campaignCalendarEvent).set({
      ...(typeof parsedInput.year === 'number' ? { year: parsedInput.year } : {}),
      ...(typeof parsedInput.month === 'number' ? { month: parsedInput.month } : {}),
      ...(typeof parsedInput.day === 'number' ? { day: parsedInput.day } : {}),
      ...(typeof parsedInput.title === 'string' ? { title: parsedInput.title } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsedInput, 'description')
        ? { description: parsedInput.description ?? null }
        : {}),
    }).where(eq(tables.campaignCalendarEvent.id, existing.id)).returning().get()!

    return toEventDto(updated)
  }

  async deleteEvent(campaignId: string, eventId: string): Promise<{ deleted: true }> {
    await db.delete(tables.campaignCalendarEvent).where(and(eq(tables.campaignCalendarEvent.id, eventId), eq(tables.campaignCalendarEvent.campaignId, campaignId))).run()

    return { deleted: true }
  }
}
