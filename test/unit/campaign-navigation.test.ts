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

    route.path = '/campaigns/c1/encounters'
    expect(navigation.sectionTitle.value).toBe('Encounters')

    route.path = '/campaigns/c1/dungeons'
    expect(navigation.sectionTitle.value).toBe('Dungeons')

    route.path = '/campaigns/c1/sessions/s1/summary'
    expect(navigation.sectionTitle.value).toBe('Session details')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Sessions',
      'Session',
      'Summary',
    ])

    route.path = '/campaigns/c1/milestones'
    expect(navigation.sectionTitle.value).toBe('Milestones')

    route.path = '/campaigns/c1/glossary'
    expect(navigation.sectionTitle.value).toBe('Glossary')

    route.path = '/campaigns/c1/maps'
    expect(navigation.sectionTitle.value).toBe('Maps')

    route.path = '/campaigns/c1/dice-roller'
    expect(navigation.sectionTitle.value).toBe('Dice Roller')

    route.path = '/campaigns/c1/settings'
    expect(navigation.sectionTitle.value).toBe('Settings')

    route.path = '/campaigns/c1/encounters/e1'
    expect(navigation.sectionTitle.value).toBe('Encounters')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Encounters',
      'Encounter',
    ])

    route.path = '/campaigns/c1/dungeons/d1'
    expect(navigation.sectionTitle.value).toBe('Dungeons')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Dungeons',
      'Dungeon',
    ])

    route.path = '/campaigns/c1/journal/j1'
    expect(navigation.sectionTitle.value).toBe('Journal')
    expect(navigation.breadcrumbItems.value.map((item) => item.label)).toEqual([
      'Campaigns',
      'Alpha Campaign',
      'Journal',
      'Entry',
    ])

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


describe('session navigation context', () => {
  it('links the session ancestor on child routes but not on its overview', () => {
    const route = reactive({ path: '/campaigns/c1/sessions/s1/summary' })
    const navigation = useCampaignNavigation(route as ReturnType<typeof useRoute>, ref('c1'), ref(null), ref('The gate'))
    expect(navigation.breadcrumbItems.value[3]).toEqual({ label: 'The gate', to: '/campaigns/c1/sessions/s1' })
    route.path = '/campaigns/c1/sessions/s1'
    expect(navigation.breadcrumbItems.value[3]).toEqual({ label: 'The gate' })
  })

  it.each(['documents', 'recordings'])('keeps %s in Sessions and reacts to the resolved parent', (section) => {
    const route = reactive({ path: `/campaigns/c1/${section}/a1` })
    const context = ref<{ sessionId?: string, title?: string }>({})
    const title = ref<string | undefined>(undefined)
    const navigation = useCampaignNavigation(route as ReturnType<typeof useRoute>, ref('c1'), ref(null), title, context)
    expect(navigation.navItems.value.filter(item => item.active).map(item => item.label)).toEqual(['Sessions'])
    expect(navigation.breadcrumbItems.value).toHaveLength(4)
    context.value = { sessionId: 's1', title: 'Session asset' }
    title.value = 'The gate'
    expect(navigation.breadcrumbItems.value.slice(2)).toEqual([
      { label: 'Sessions', to: '/campaigns/c1/sessions' },
      { label: 'The gate', to: '/campaigns/c1/sessions/s1' },
      { label: 'Session asset' },
    ])
    context.value = { sessionId: 's2', title: 'Other asset' }
    title.value = 'The tower'
    expect(navigation.breadcrumbItems.value[3]).toEqual({ label: 'The tower', to: '/campaigns/c1/sessions/s2' })
    route.path = '/campaigns/c1/quests'
    expect(navigation.navItems.value.filter(item => item.active).map(item => item.label)).toEqual(['Quests'])
    expect(navigation.breadcrumbItems.value.at(-1)).toEqual({ label: 'Quests' })
  })
})
