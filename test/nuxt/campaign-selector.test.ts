import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, useRoute } from 'vue-router'
import { USelectMenu } from '#components'
import { useCampaignSelector } from '../../app/composables/useCampaignSelector'

type Campaign = { id: string; name: string }
type Selector = ReturnType<typeof useCampaignSelector>
const knownCampaigns = [{ id: 'c1', name: 'First campaign' }, { id: 'c2', name: 'Second campaign' }]
let wrapper: VueWrapper | undefined
let host: HTMLDivElement | undefined
let removeGuard: (() => void) | undefined

afterEach(() => {
  removeGuard?.()
  removeGuard = undefined
  wrapper?.unmount()
  wrapper = undefined
  host?.remove()
  host = undefined
  vi.restoreAllMocks()
})

async function openSelector(path: string, initialCampaigns: Campaign[] | null | undefined = knownCampaigns) {
  const campaigns = ref<Campaign[] | null | undefined>(initialCampaigns)
  const emptyPage = defineComponent({ render: () => null })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: emptyPage },
      { path: '/campaigns', component: emptyPage },
      { path: '/campaigns/:campaignId/:rest(.*)*', component: emptyPage },
      { path: '/settings', component: emptyPage },
    ],
  })
  await router.push(path)
  await router.isReady()
  let selector!: Selector
  host = document.createElement('div')
  document.body.append(host)
  wrapper = mount(defineComponent({
    setup() {
      selector = useCampaignSelector(useRoute(), router, campaigns)
      return () => h(USelectMenu<Selector['campaignOptions']['value'], 'id'>, {
        'aria-label': 'Campaign',
        items: selector.campaignOptions.value,
        modelValue: selector.selectedCampaignId.value,
        'onUpdate:modelValue': selector.selectCampaign,
        valueKey: 'id',
        portal: false,
      })
    },
  }), { attachTo: host, global: { plugins: [router] } })
  await flushPromises()
  return { campaigns, router, selector }
}

const selectedLabel = () => wrapper!.get('[data-slot="value"]').text()

async function chooseCampaign(label: string) {
  await wrapper!.get('button[aria-label="Campaign"]').trigger('click')
  await flushPromises()
  const option = wrapper!.findAll('[role="option"]').find(item => item.text() === label)
  expect(option, `Campaign option not found: ${label}`).toBeDefined()
  await option!.trigger('click')
  await flushPromises()
}

describe('campaign selection', () => {
  it('keeps the selected campaign on the route while an exit guard is pending or canceled, then switches sections after approval', async () => {
    const { router, selector } = await openSelector('/campaigns/c1/sessions/s1/summary')
    const push = vi.spyOn(router, 'push')
    await selector.selectCampaign('c1')
    await selector.selectCampaign(undefined)
    expect(push).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/campaigns/c1/sessions/s1/summary')

    let resolveExit!: (allowed: boolean) => void
    removeGuard = router.beforeEach(() => new Promise<boolean>(resolve => { resolveExit = resolve }))
    await chooseCampaign('Second campaign')
    expect(selectedLabel()).toBe('First campaign')
    expect(selector.selectedCampaignId.value).toBe('c1')
    resolveExit(false)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/campaigns/c1/sessions/s1/summary')
    expect(selectedLabel()).toBe('First campaign')

    await chooseCampaign('Second campaign')
    resolveExit(true)
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/campaigns/c2/sessions')
    expect(selectedLabel()).toBe('Second campaign')
    expect(push).toHaveBeenCalledTimes(2)
  })

  it('tracks direct navigation and Back/Forward without creating extra history entries', async () => {
    const { router, selector } = await openSelector('/campaigns/c1/maps/map1')
    await chooseCampaign('Second campaign')
    expect(router.currentRoute.value.path).toBe('/campaigns/c2/maps')
    await chooseCampaign('All campaigns')
    expect(router.currentRoute.value.path).toBe('/campaigns')
    expect(selectedLabel()).toBe('All campaigns')

    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/campaigns/c2/maps'))
    expect(selectedLabel()).toBe('Second campaign')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/campaigns/c1/maps/map1'))
    expect(selectedLabel()).toBe('First campaign')
    router.forward()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/campaigns/c2/maps'))
    expect(selectedLabel()).toBe('Second campaign')

    await router.push('/campaigns/c1/quests')
    await nextTick()
    expect(selector.selectedCampaignId.value).toBe('c1')
    expect(selectedLabel()).toBe('First campaign')
  })

  it('retains missing campaign identity through delayed, empty and failed option loads without navigating', async () => {
    const { campaigns, router, selector } = await openSelector('/campaigns/c1/quests', null)
    const push = vi.spyOn(router, 'push')
    for (const value of [undefined, [], [knownCampaigns[1]!], null]) {
      campaigns.value = value
      await nextTick()
      expect(selector.selectedCampaignId.value).toBe('c1')
      expect(selector.campaignOptions.value).toContainEqual({ id: 'c1', label: 'Current campaign', disabled: true })
      expect(selectedLabel()).toBe('Current campaign')
      expect(router.currentRoute.value.path).toBe('/campaigns/c1/quests')
    }
    campaigns.value = knownCampaigns
    await nextTick()
    expect(selectedLabel()).toBe('First campaign')
    expect(selector.campaignOptions.value.filter(option => option.id === 'c1')).toHaveLength(1)
    expect(push).not.toHaveBeenCalled()

    await router.push('/settings')
    push.mockClear()
    await selector.selectCampaign('c2')
    expect(selector.showCampaignSelect.value).toBe(false)
    expect(selector.selectedCampaignId.value).toBe('all')
    expect(push).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/settings')
  })
})
