import { describe, expect, it } from 'vitest'
import {
  campaignJournalDiscoverInputSchema,
  campaignJournalDiscoverableUpdateSchema,
  campaignJournalTransferInputSchema,
} from '../../shared/schemas/campaign-journal'

describe('campaign journal discoverable schemas', () => {

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
})
