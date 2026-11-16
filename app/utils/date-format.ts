const dateFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

type DateInput = string | number | Date | null | undefined

// Intl.DateTimeFormat.format throws on invalid dates, so missing or bad values render empty.
const format = (formatter: Intl.DateTimeFormat, value: DateInput) => {
  if (value === null || value === undefined || value === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : formatter.format(date)
}

/** "Nov 16, 2026" */
export const formatDate = (value: DateInput) => format(dateFormatter, value)

/** "Nov 16, 2026, 3:04 PM" */
export const formatDateTime = (value: DateInput) => format(dateTimeFormatter, value)
