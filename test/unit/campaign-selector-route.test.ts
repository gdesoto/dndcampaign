import { describe, expect, it } from 'vitest'
import { resolveCampaignSelectorRoute } from '../../app/composables/useCampaignSelectorRoute'

describe('resolveCampaignSelectorRoute', () => {
  it('routes to campaigns index when selecting all', () => {
    expect(resolveCampaignSelectorRoute('/campaigns/abc/sessions', 'abc', 'all')).toBe('/campaigns')
  })

  it('keeps overview when switching from campaign overview', () => {
    expect(resolveCampaignSelectorRoute('/campaigns/abc', 'abc', 'xyz')).toBe('/campaigns/xyz')
  })

  it('keeps section root for nested session detail routes', () => {
    expect(
      resolveCampaignSelectorRoute('/campaigns/abc/sessions/session-1/summary', 'abc', 'xyz')
    ).toBe('/campaigns/xyz/sessions')
  })

  it('keeps section root for quest detail routes', () => {
    expect(resolveCampaignSelectorRoute('/campaigns/abc/quests/quest-1', 'abc', 'xyz')).toBe(
      '/campaigns/xyz/quests'
    )
  })

  it('keeps maps section when switching campaigns', () => {
    expect(resolveCampaignSelectorRoute('/campaigns/abc/maps', 'abc', 'xyz')).toBe(
      '/campaigns/xyz/maps'
    )
  })

  it('falls back to target overview for unknown suffixes', () => {
    expect(resolveCampaignSelectorRoute('/campaigns/abc/unknown/path', 'abc', 'xyz')).toBe(
      '/campaigns/xyz'
    )
  })
})
