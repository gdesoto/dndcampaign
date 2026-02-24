import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCampaignOverviewMetrics } from '../../app/composables/useCampaignOverviewMetrics'
import { useCampaignActivityItems } from '../../app/composables/useCampaignActivityItems'

describe('useCampaignOverviewMetrics', () => {
  it('computes key counts and recency order', () => {
    const sessions = ref([
      { id: 's1', title: 'One', sessionNumber: 1, playedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 's2', title: 'Two', sessionNumber: 2, playedAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' },
    ])
    const quests = ref([
      { id: 'q1', title: 'Q1', type: 'MAIN' as const, status: 'ACTIVE' as const, updatedAt: '2026-02-02T00:00:00.000Z' },
      { id: 'q2', title: 'Q2', type: 'SIDE' as const, status: 'FAILED' as const, updatedAt: '2026-01-15T00:00:00.000Z' },
    ])
    const milestones = ref([
      { id: 'm1', title: 'M1', isComplete: false, createdAt: '2026-01-10T00:00:00.000Z' },
      { id: 'm2', title: 'M2', isComplete: true, completedAt: '2026-02-03T00:00:00.000Z' },
    ])

    const metrics = useCampaignOverviewMetrics(sessions, quests, milestones)

    expect(metrics.latestSession.value?.id).toBe('s2')
    expect(metrics.activeQuestCount.value).toBe(1)
    expect(metrics.openMilestoneCount.value).toBe(1)
    expect(metrics.recentSessions.value.map((item) => item.id)).toEqual(['s2', 's1'])
    expect(metrics.recentQuests.value.map((item) => item.id)).toEqual(['q1', 'q2'])
    expect(metrics.questStatusColor('FAILED')).toBe('error')
  })
})

describe('useCampaignActivityItems', () => {
  it('builds sorted activity feed and caps to 6 items', () => {
    const campaign = ref({
      id: 'c1',
      name: 'Alpha',
      system: 'DND 5e',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-05T00:00:00.000Z',
    })
    const recaps = ref([
      { id: 'r1', createdAt: '2026-02-04T00:00:00.000Z', session: { title: 'Session A' } },
      { id: 'r2', createdAt: '2026-02-03T00:00:00.000Z', session: { title: 'Session B' } },
    ])
    const sessions = ref([
      { id: 's1', title: 'S1', sessionNumber: 1, playedAt: '2026-02-02T00:00:00.000Z', createdAt: '2026-02-02T00:00:00.000Z' },
      { id: 's2', title: 'S2', sessionNumber: 2, playedAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-02-01T00:00:00.000Z' },
    ])
    const quests = ref([
      { id: 'q1', title: 'Quest', type: 'PLAYER' as const, status: 'ON_HOLD' as const, updatedAt: '2026-01-31T00:00:00.000Z' },
    ])
    const milestones = ref([
      { id: 'm1', title: 'Milestone', isComplete: true, completedAt: '2026-01-30T00:00:00.000Z' },
      { id: 'm2', title: 'Milestone 2', isComplete: false, createdAt: '2026-01-29T00:00:00.000Z' },
    ])
    const activityLogs = ref([])

    const { activityItems } = useCampaignActivityItems(campaign, activityLogs, recaps, sessions, quests, milestones)
    const items = activityItems.value

    expect(items).toHaveLength(6)
    expect(items[0]?.id).toBe('campaign-c1')
    expect(items.map((item) => item.id)).toContain('recap-r1')
    expect(items.map((item) => item.id)).not.toContain('milestone-m2')
  })
})
