import { describe, expect, it, vi } from 'vitest'
import { useCampaignWorkspaceInvalidation } from '../../app/composables/useCampaignWorkspaceInvalidation'
import { useSessionWorkspaceInvalidation } from '../../app/composables/useSessionWorkspaceInvalidation'

describe('useSessionWorkspaceInvalidation', () => {
  it('maps mutation hooks to the expected refresh handlers', async () => {
    const refreshAll = vi.fn(async () => {})
    const refreshSession = vi.fn(async () => {})
    const refreshRecordings = vi.fn(async () => {})
    const refreshRecap = vi.fn(async () => {})
    const refreshTranscript = vi.fn(async () => {})
    const refreshSummary = vi.fn(async () => {})

    const invalidation = useSessionWorkspaceInvalidation({
      refreshAll,
      refreshSession,
      refreshRecordings,
      refreshRecap,
      refreshTranscript,
      refreshSummary,
    })

    await invalidation.refreshWorkspace()
    await invalidation.afterSessionMutation()
    await invalidation.afterRecordingsMutation()
    await invalidation.afterRecapMutation()
    await invalidation.afterTranscriptMutation()
    await invalidation.afterSummaryMutation()

    expect(refreshAll).toHaveBeenCalledTimes(1)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(refreshRecordings).toHaveBeenCalledTimes(1)
    expect(refreshRecap).toHaveBeenCalledTimes(1)
    expect(refreshTranscript).toHaveBeenCalledTimes(1)
    expect(refreshSummary).toHaveBeenCalledTimes(1)
  })
})

describe('useCampaignWorkspaceInvalidation', () => {
  it('uses campaign refresh for workspace and mutation hooks', async () => {
    const refreshCampaign = vi.fn(async () => {})
    const invalidation = useCampaignWorkspaceInvalidation({ refreshCampaign })

    await invalidation.refreshWorkspace()
    await invalidation.afterCampaignMutation()
    await invalidation.afterRecapMutation()

    expect(refreshCampaign).toHaveBeenCalledTimes(3)
  })
})
