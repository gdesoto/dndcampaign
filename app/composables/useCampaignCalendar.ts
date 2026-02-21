import type {
  CalendarConfigUpsertInput,
  CalendarCurrentDateUpdateInput,
  CalendarEventCreateInput,
  CalendarEventUpdateInput,
  CalendarEventQueryInput,
  CalendarNameGenerateInput,
  CalendarTemplateApplyInput,
  SessionCalendarRangeWriteInput,
  CalendarViewQueryInput,
} from '#shared/schemas/calendar'
import type {
  CampaignCalendarConfig,
  CampaignCalendarEvent,
  SessionCalendarRange,
} from '#shared/types/calendar'

export type CampaignCalendarConfigDto = CampaignCalendarConfig & {
  yearLength: number
}

export type SessionCalendarRangeWithSession = SessionCalendarRange & {
  session: {
    id: string
    title: string
    sessionNumber?: number | null
    playedAt?: string | null
  } | null
}

export type CampaignCalendarViewDto = {
  config: CampaignCalendarConfigDto | null
  currentDate: { year: number, month: number, day: number } | null
  selectedMonth: {
    year: number
    month: number
    index: number
    name: string
    length: number
  } | null
  events: CampaignCalendarEvent[]
  sessionRanges: SessionCalendarRangeWithSession[]
}

export const useCampaignCalendar = () => {
  const { request } = useApi()

  const getConfig = (campaignId: string) =>
    request<CampaignCalendarConfigDto | null>(`/api/campaigns/${campaignId}/calendar-config`)

  const upsertConfig = (campaignId: string, payload: CalendarConfigUpsertInput) =>
    request<CampaignCalendarConfigDto>(`/api/campaigns/${campaignId}/calendar-config`, {
      method: 'PUT',
      body: payload,
    })

  const applyTemplate = (
    campaignId: string,
    payload: CalendarTemplateApplyInput,
  ) =>
    request<CampaignCalendarConfigDto>(`/api/campaigns/${campaignId}/calendar-config/template`, {
      method: 'POST',
      body: payload,
    })

  const updateCurrentDate = (campaignId: string, payload: CalendarCurrentDateUpdateInput) =>
    request<CampaignCalendarConfigDto>(`/api/campaigns/${campaignId}/calendar-config/current-date`, {
      method: 'PUT',
      body: payload,
    })

  const generateNames = (campaignId: string, payload: CalendarNameGenerateInput) =>
    request<{ kind: CalendarNameGenerateInput['kind'], names: string[] }>(
      `/api/campaigns/${campaignId}/calendar/generate-name`,
      {
        method: 'POST',
        body: payload,
      },
    )

  const getEvents = (campaignId: string, query?: CalendarEventQueryInput) =>
    request<CampaignCalendarEvent[]>(`/api/campaigns/${campaignId}/calendar-events`, {
      query,
    })

  const createEvent = (campaignId: string, payload: CalendarEventCreateInput) =>
    request<CampaignCalendarEvent>(`/api/campaigns/${campaignId}/calendar-events`, {
      method: 'POST',
      body: payload,
    })

  const updateEvent = (campaignId: string, eventId: string, payload: CalendarEventUpdateInput) =>
    request<CampaignCalendarEvent>(`/api/campaigns/${campaignId}/calendar-events/${eventId}`, {
      method: 'PATCH',
      body: payload,
    })

  const deleteEvent = (campaignId: string, eventId: string) =>
    request<{ deleted: true }>(`/api/campaigns/${campaignId}/calendar-events/${eventId}`, {
      method: 'DELETE',
    })

  const getRanges = (campaignId: string) =>
    request<SessionCalendarRange[]>(`/api/campaigns/${campaignId}/calendar-ranges`)

  const upsertSessionRange = (sessionId: string, payload: SessionCalendarRangeWriteInput) =>
    request<SessionCalendarRange>(`/api/sessions/${sessionId}/calendar-range`, {
      method: 'PUT',
      body: payload,
    })

  const deleteSessionRange = (sessionId: string) =>
    request<{ deleted: true }>(`/api/sessions/${sessionId}/calendar-range`, {
      method: 'DELETE',
    })

  const getCalendarView = (campaignId: string, query?: CalendarViewQueryInput) =>
    request<CampaignCalendarViewDto>(`/api/campaigns/${campaignId}/calendar-view`, {
      query,
    })

  return {
    getConfig,
    upsertConfig,
    applyTemplate,
    updateCurrentDate,
    generateNames,
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getRanges,
    upsertSessionRange,
    deleteSessionRange,
    getCalendarView,
  }
}
