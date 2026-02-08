import { describe, expect, it } from 'vitest'
import { reactive, ref } from 'vue'
import { useCampaignNavigation } from '../../app/composables/useCampaignNavigation'

describe('useCampaignNavigation', () => {
  it('maps campaign subroutes to section labels and breadcrumbs', () => {
    const route = reactive({ path: '/campaigns/c1' })
    const campaignId = ref('c1')
    const campaign = ref({ id: 'c1', name: 'Alpha Campaign' })

    const navigation = useCampaignNavigation(route as ReturnType<typeof useRoute>, campaignId, campaign)

    expect(navigation.sectionTitle.value).toBe('Overview')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual(['Campaigns', 'Alpha Campaign'])

    route.path = '/campaigns/c1/quests'
    expect(navigation.sectionTitle.value).toBe('Quests')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Quests',
    ])

    route.path = '/campaigns/c1/characters'
    expect(navigation.sectionTitle.value).toBe('Characters')

    route.path = '/campaigns/c1/sessions'
    expect(navigation.sectionTitle.value).toBe('Sessions')

    route.path = '/campaigns/c1/sessions/s1/summary'
    expect(navigation.sectionTitle.value).toBe('Session details')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Sessions',
      'Session details',
    ])

    route.path = '/campaigns/c1/milestones'
    expect(navigation.sectionTitle.value).toBe('Milestones')

    route.path = '/campaigns/c1/glossary'
    expect(navigation.sectionTitle.value).toBe('Glossary')

    route.path = '/campaigns/c1/settings'
    expect(navigation.sectionTitle.value).toBe('Settings')

    route.path = '/campaigns/c1/unknown'
    expect(navigation.sectionTitle.value).toBe('Overview')
  })

  it('falls back to campaign placeholder labels when campaign data is missing', () => {
    const route = reactive({ path: '/campaigns/c1/settings' })
    const campaignId = ref('c1')
    const campaign = ref(null)

    const navigation = useCampaignNavigation(route as ReturnType<typeof useRoute>, campaignId, campaign)

    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Campaign',
      'Settings',
    ])
  })
})
