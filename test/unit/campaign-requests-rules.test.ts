import { describe, expect, it } from 'vitest'
import {
  campaignRequestDecisionInputSchema,
  campaignRequestListQuerySchema,
  campaignRequestStatusSchema,
  campaignRequestUpdateSchema,
  campaignRequestVisibilitySchema,
} from '../../shared/schemas/campaign-requests'

describe('campaign request schemas', () => {
  it('accepts valid status/visibility values and rejects invalid values', () => {
    expect(campaignRequestStatusSchema.safeParse('PENDING').success).toBe(true)
    expect(campaignRequestStatusSchema.safeParse('COMPLETED').success).toBe(false)
    expect(campaignRequestVisibilitySchema.safeParse('PUBLIC').success).toBe(true)
    expect(campaignRequestVisibilitySchema.safeParse('TEAM_ONLY').success).toBe(false)
  })

  it('rejects empty update payload and accepts non-empty', () => {
    expect(campaignRequestUpdateSchema.safeParse({}).success).toBe(false)
    expect(campaignRequestUpdateSchema.safeParse({ title: 'Updated title' }).success).toBe(true)
  })

  it('validates decision schema and list query defaults', () => {
    expect(
      campaignRequestDecisionInputSchema.safeParse({
        decision: 'APPROVED',
        decisionNote: 'Works for this campaign',
      }).success,
    ).toBe(true)

    const parsedList = campaignRequestListQuerySchema.parse({})
    expect(parsedList.page).toBe(1)
    expect(parsedList.pageSize).toBe(20)
  })
})
