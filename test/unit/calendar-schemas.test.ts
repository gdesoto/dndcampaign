import { describe, expect, it } from 'vitest'
import {
  calendarConfigUpsertSchema,
  createSessionCalendarRangeSchema,
} from '../../shared/schemas/calendar'

describe('calendar schemas', () => {
  it('rejects current date outside configured month bounds', () => {
    const parsed = calendarConfigUpsertSchema.safeParse({
      isEnabled: true,
      name: 'Faerun',
      startingYear: 1492,
      firstWeekdayIndex: 0,
      currentYear: 1492,
      currentMonth: 3,
      currentDay: 1,
      weekdays: [{ name: 'Moonday' }],
      months: [
        { name: 'Hammer', length: 30 },
        { name: 'Alturiak', length: 30 },
      ],
      moons: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects current day beyond selected month length', () => {
    const parsed = calendarConfigUpsertSchema.safeParse({
      isEnabled: true,
      name: 'Faerun',
      startingYear: 1492,
      firstWeekdayIndex: 0,
      currentYear: 1492,
      currentMonth: 1,
      currentDay: 31,
      weekdays: [{ name: 'Moonday' }],
      months: [{ name: 'Hammer', length: 30 }],
      moons: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects session ranges when end date is before start date', () => {
    const schema = createSessionCalendarRangeSchema([{ length: 30 }, { length: 30 }])
    const parsed = schema.safeParse({
      startYear: 1492,
      startMonth: 2,
      startDay: 10,
      endYear: 1492,
      endMonth: 2,
      endDay: 9,
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects session range dates outside configured month/day bounds', () => {
    const schema = createSessionCalendarRangeSchema([{ length: 30 }, { length: 28 }])
    const parsed = schema.safeParse({
      startYear: 1492,
      startMonth: 2,
      startDay: 29,
      endYear: 1492,
      endMonth: 2,
      endDay: 29,
    })

    expect(parsed.success).toBe(false)
  })

  it('accepts valid session ranges within configured bounds', () => {
    const schema = createSessionCalendarRangeSchema([{ length: 30 }, { length: 28 }])
    const parsed = schema.safeParse({
      startYear: 1492,
      startMonth: 2,
      startDay: 10,
      endYear: 1492,
      endMonth: 2,
      endDay: 12,
    })

    expect(parsed.success).toBe(true)
  })
})
