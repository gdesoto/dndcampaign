const sessionDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export const formatSessionDate = (value?: string | null) => {
  if (!value) return 'Unscheduled'

  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!isoDateMatch) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString()
  }

  const [, year, month, day] = isoDateMatch
  return sessionDateFormatter.format(
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  )
}

export const serializeSessionDateInput = (value?: string | null) =>
  value ? `${value}T00:00:00.000Z` : null
