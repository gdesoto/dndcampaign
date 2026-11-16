import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../../app/utils/date-format'

describe('date formatting', () => {
  it('formats valid dates and renders missing or invalid values empty instead of throwing', () => {
    const value = '2026-11-16T15:04:12.000Z'
    expect(formatDate(value)).toBe(new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)))
    expect(formatDateTime(value)).not.toMatch(/:12\b/) // minutes only, no seconds
    for (const empty of [null, undefined, '', 'not a date']) {
      expect(formatDate(empty)).toBe('')
      expect(formatDateTime(empty)).toBe('')
    }
  })
})
