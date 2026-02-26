import { describe, expect, it } from 'vitest'
import {
  campaignJournalArchiveInputSchema,
  campaignJournalDiscoverInputSchema,
  campaignJournalDiscoverableUpdateSchema,
  campaignJournalHistoryListQuerySchema,
  campaignJournalListQuerySchema,
  campaignJournalNotificationListQuerySchema,
  campaignJournalTransferHistoryActionSchema,
  campaignJournalTransferInputSchema,
} from '../../shared/schemas/campaign-journal'

describe('campaign journal discoverable schemas', () => {
  it('accepts discoverable list filters and defaults', () => {
    const parsed = campaignJournalListQuerySchema.parse({
      discoverable: 'true',
      heldByMe: '1',
      includeArchived: 'false',
      archived: 'false',
      recentlyDiscovered: 'true',
    })

    expect(parsed.discoverable).toBe(true)
    expect(parsed.heldByMe).toBe(true)
    expect(parsed.includeArchived).toBe(false)
    expect(parsed.archived).toBe(false)
    expect(parsed.recentlyDiscovered).toBe(true)
    expect(parsed.page).toBe(1)
    expect(parsed.pageSize).toBe(20)
  })

  it('enforces discoverable visibility floor on discover/update/transfer payloads', () => {
    expect(
      campaignJournalDiscoverInputSchema.safeParse({
        holderUserId: '7f3ef9f6-a5fe-4da7-9f2b-3aeb86b29206',
        visibility: 'DM',
      }).success,
    ).toBe(true)
    expect(
      campaignJournalDiscoverInputSchema.safeParse({
        holderUserId: '7f3ef9f6-a5fe-4da7-9f2b-3aeb86b29206',
        visibility: 'MYSELF',
      }).success,
    ).toBe(false)

    expect(
      campaignJournalTransferInputSchema.safeParse({
        toHolderUserId: null,
        visibility: 'CAMPAIGN',
      }).success,
    ).toBe(true)
    expect(
      campaignJournalTransferInputSchema.safeParse({
        toHolderUserId: '7f3ef9f6-a5fe-4da7-9f2b-3aeb86b29206',
        visibility: 'MYSELF',
      }).success,
    ).toBe(false)

    expect(
      campaignJournalDiscoverableUpdateSchema.safeParse({
        isDiscoverable: true,
        visibility: 'MYSELF',
      }).success,
    ).toBe(false)
  })

  it('validates history/notification query defaults and action enums', () => {
    const historyQuery = campaignJournalHistoryListQuerySchema.parse({})
    const notificationQuery = campaignJournalNotificationListQuerySchema.parse({})

    expect(historyQuery.page).toBe(1)
    expect(historyQuery.pageSize).toBe(20)
    expect(notificationQuery.page).toBe(1)
    expect(notificationQuery.pageSize).toBe(20)

    expect(campaignJournalTransferHistoryActionSchema.safeParse('TRANSFERRED').success).toBe(true)
    expect(campaignJournalTransferHistoryActionSchema.safeParse('DELETED').success).toBe(false)
  })

  it('supports archive payload defaults', () => {
    const parsed = campaignJournalArchiveInputSchema.parse({})
    expect(parsed.archived).toBe(true)
  })
})
