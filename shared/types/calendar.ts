export type CalendarTemplateId =
  | 'earth'
  | 'tonalpohualli'
  | 'fantasy_a'
  | 'fantasy_b'
  | 'random'

export type CalendarNameKind = 'weekday' | 'month' | 'moon'

export type CalendarWeekday = {
  name: string
}

export type CalendarMonth = {
  name: string
  length: number
}

export type CalendarMoon = {
  name: string
  cycleLength: number
  phaseOffset: number
}

export type CalendarDateParts = {
  year: number
  month: number
  day: number
}

export type CampaignCalendarConfig = {
  id: string
  campaignId: string
  isEnabled: boolean
  name: string
  startingYear: number
  firstWeekdayIndex: number
  currentYear: number
  currentMonth: number
  currentDay: number
  weekdays: CalendarWeekday[]
  months: CalendarMonth[]
  moons: CalendarMoon[]
  createdAt: string
  updatedAt: string
}

export type SessionCalendarRange = {
  id: string
  sessionId: string
  campaignId: string
  startYear: number
  startMonth: number
  startDay: number
  endYear: number
  endMonth: number
  endDay: number
  createdAt: string
  updatedAt: string
}

export type CampaignCalendarEvent = {
  id: string
  campaignId: string
  year: number
  month: number
  day: number
  title: string
  description?: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}
