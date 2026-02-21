import { z } from 'zod'

export const calendarTemplateIdSchema = z.enum([
  'earth',
  'tonalpohualli',
  'fantasy_a',
  'fantasy_b',
  'random',
])
export const calendarNameKindSchema = z.enum(['weekday', 'month', 'moon'])

export const calendarWeekdaySchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export const calendarMonthSchema = z.object({
  name: z.string().trim().min(1).max(120),
  length: z.number().int().min(1).max(999),
})

export const calendarMoonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cycleLength: z.number().int().min(1).max(9999),
  phaseOffset: z.number().int().min(0).max(9999),
})

export const calendarDateSchema = z.object({
  year: z.number().int(),
  month: z.number().int().positive(),
  day: z.number().int().positive(),
})

const sessionCalendarRangeSchemaBase = z.object({
  startYear: z.number().int(),
  startMonth: z.number().int().positive(),
  startDay: z.number().int().positive(),
  endYear: z.number().int(),
  endMonth: z.number().int().positive(),
  endDay: z.number().int().positive(),
})

export const sessionCalendarRangeWriteSchema = z.object({
  startYear: z.number().int(),
  startMonth: z.number().int().positive(),
  startDay: z.number().int().positive(),
  endYear: z.number().int().optional(),
  endMonth: z.number().int().positive().optional(),
  endDay: z.number().int().positive().optional(),
})

export const calendarConfigUpsertSchema = z
  .object({
    isEnabled: z.boolean(),
    name: z.string().trim().min(1).max(160),
    startingYear: z.number().int(),
    firstWeekdayIndex: z.number().int().min(0),
    currentYear: z.number().int(),
    currentMonth: z.number().int().positive(),
    currentDay: z.number().int().positive(),
    weekdays: z.array(calendarWeekdaySchema),
    months: z.array(calendarMonthSchema),
    moons: z.array(calendarMoonSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.isEnabled && value.weekdays.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['weekdays'],
        message: 'At least one weekday is required when calendar is enabled',
      })
    }
    if (value.isEnabled && value.months.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['months'],
        message: 'At least one month is required when calendar is enabled',
      })
    }
    if (value.weekdays.length > 0 && value.firstWeekdayIndex >= value.weekdays.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['firstWeekdayIndex'],
        message: 'First weekday index must be within weekday list bounds',
      })
    }
    if (value.isEnabled) {
      validateCalendarDateBounds(
        {
          year: value.currentYear,
          month: value.currentMonth,
          day: value.currentDay,
        },
        value.months,
        ctx,
        ['currentDay'],
      )
    }
  })

export const calendarTemplateApplySchema = z.object({
  templateId: calendarTemplateIdSchema,
})

export const calendarCurrentDateUpdateSchema = calendarDateSchema

export const sessionCalendarRangeUpsertSchema = sessionCalendarRangeSchemaBase.superRefine((value, ctx) => {
  if (
    compareCalendarDates(
      { year: value.endYear, month: value.endMonth, day: value.endDay },
      { year: value.startYear, month: value.startMonth, day: value.startDay },
    ) < 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endYear'],
      message: 'End date cannot be before start date',
    })
  }
})

export const calendarNameGenerateSchema = z.object({
  kind: calendarNameKindSchema,
  count: z.number().int().min(1).max(50).default(1),
  seed: z.string().min(1).max(120).optional(),
})

export const calendarEventQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().positive().optional(),
})

export const calendarViewQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().positive().optional(),
})

export const calendarEventCreateSchema = z.object({
  year: z.number().int(),
  month: z.number().int().positive(),
  day: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
})

export const calendarEventUpdateSchema = z
  .object({
    year: z.number().int().optional(),
    month: z.number().int().positive().optional(),
    day: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
    path: ['title'],
  })

export function validateCalendarDateBounds(
  date: { year: number, month: number, day: number },
  months: Array<{ length: number }>,
  ctx?: z.RefinementCtx,
  path: Array<string | number> = ['day'],
): boolean {
  if (months.length < 1) {
    if (ctx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: 'Calendar must include at least one month',
      })
    }
    return false
  }

  if (date.month > months.length) {
    if (ctx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `Month must be between 1 and ${months.length}`,
      })
    }
    return false
  }

  const month = months[date.month - 1]
  if (!month) {
    if (ctx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `Month must be between 1 and ${months.length}`,
      })
    }
    return false
  }

  if (date.day > month.length) {
    if (ctx) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: `Day must be between 1 and ${month.length} for month ${date.month}`,
      })
    }
    return false
  }

  return true
}

export function createCalendarDateBoundsSchema(months: Array<{ length: number }>) {
  return calendarDateSchema.superRefine((value, ctx) => {
    validateCalendarDateBounds(value, months, ctx)
  })
}

export function createSessionCalendarRangeSchema(months: Array<{ length: number }>) {
  return sessionCalendarRangeUpsertSchema.superRefine((value, ctx) => {
    const start = { year: value.startYear, month: value.startMonth, day: value.startDay }
    const end = { year: value.endYear, month: value.endMonth, day: value.endDay }

    validateCalendarDateBounds(start, months, ctx, ['startDay'])
    validateCalendarDateBounds(end, months, ctx, ['endDay'])
  })
}

function compareCalendarDates(
  left: { year: number, month: number, day: number },
  right: { year: number, month: number, day: number },
): number {
  if (left.year !== right.year) {
    return left.year - right.year
  }
  if (left.month !== right.month) {
    return left.month - right.month
  }
  return left.day - right.day
}

export type CalendarConfigUpsertInput = z.infer<typeof calendarConfigUpsertSchema>
export type CalendarTemplateApplyInput = z.infer<typeof calendarTemplateApplySchema>
export type CalendarCurrentDateUpdateInput = z.infer<typeof calendarCurrentDateUpdateSchema>
export type SessionCalendarRangeUpsertInput = z.infer<typeof sessionCalendarRangeUpsertSchema>
export type SessionCalendarRangeWriteInput = z.infer<typeof sessionCalendarRangeWriteSchema>
export type CalendarNameGenerateInput = z.infer<typeof calendarNameGenerateSchema>
export type CalendarEventQueryInput = z.infer<typeof calendarEventQuerySchema>
export type CalendarViewQueryInput = z.infer<typeof calendarViewQuerySchema>
export type CalendarEventCreateInput = z.infer<typeof calendarEventCreateSchema>
export type CalendarEventUpdateInput = z.infer<typeof calendarEventUpdateSchema>
