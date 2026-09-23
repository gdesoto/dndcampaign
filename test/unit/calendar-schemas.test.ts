import { expect, it } from 'vitest'
import { calendarConfigUpsertSchema, createSessionCalendarRangeSchema } from '../../shared/schemas/calendar'

it('validates dates and chronological session ranges against the campaign calendar', () => {
  const months = [{ name: 'Hammer', length: 30 }, { name: 'Alturiak', length: 28 }]
  const config = {
    isEnabled: true, name: 'Faerun', startingYear: 1492, firstWeekdayIndex: 0,
    currentYear: 1492, currentMonth: 2, currentDay: 28,
    weekdays: [{ name: 'Moonday' }], months, moons: [],
  }
  expect(calendarConfigUpsertSchema.safeParse(config).success).toBe(true)
  expect(calendarConfigUpsertSchema.safeParse({ ...config, currentMonth: 3 }).success).toBe(false)
  expect(calendarConfigUpsertSchema.safeParse({ ...config, currentDay: 29 }).success).toBe(false)

  const schema = createSessionCalendarRangeSchema(months)
  const range = { startYear: 1492, startMonth: 2, startDay: 27, endYear: 1492, endMonth: 2, endDay: 28 }
  expect(schema.safeParse(range).success).toBe(true)
  expect(schema.safeParse({ ...range, endDay: 26 }).success).toBe(false)
  expect(schema.safeParse({ ...range, endDay: 29 }).success).toBe(false)
})
