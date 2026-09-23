import { expect, it } from 'vitest'
import { resolveCampaignSelectorRoute } from '../../app/composables/useCampaignSelectorRoute'

it('switches campaigns without carrying a child record into the target campaign', () => {
  expect(resolveCampaignSelectorRoute('/campaigns/abc/sessions/s1/summary', 'abc', 'xyz')).toBe('/campaigns/xyz/sessions')
  expect(resolveCampaignSelectorRoute('/campaigns/abc/maps', 'abc', 'xyz')).toBe('/campaigns/xyz/maps')
  expect(resolveCampaignSelectorRoute('/campaigns/abc', 'abc', 'xyz')).toBe('/campaigns/xyz')
  expect(resolveCampaignSelectorRoute('/campaigns/abc/unknown/path', 'abc', 'xyz')).toBe('/campaigns/xyz')
  expect(resolveCampaignSelectorRoute('/campaigns/abc/sessions', 'abc', 'all')).toBe('/campaigns')
})
