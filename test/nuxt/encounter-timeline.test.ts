import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import EventTimeline from '../../app/components/encounter/EventTimeline.vue'
import type { EncounterEvent } from '../../shared/types/encounter'

const events: EncounterEvent[] = [
  { id: 'old', encounterId: 'enc', eventType: 'NOTE', summary: 'An earlier note', createdAt: '2026-09-20T10:00:00Z' },
  { id: 'new', encounterId: 'enc', eventType: 'HP', summary: 'Guard takes damage', payload: { action: 'hp.damage' }, createdAt: '2026-09-20T11:00:00Z' },
]

describe('Encounter timeline', () => {
  it('sorts newest first, reverses order, filters types, and recovers from no matches', async () => {
    const wrapper = await mountSuspended(EventTimeline, { props: { events }, global: { stubs: {
      UTooltip: { template: '<slot />' },
      UDropdownMenu: { props: ['items'], template: `<div><slot /><button v-for="item in items" :key="item.label" @click="item.onUpdateChecked(!item.checked)">{{ item.label }}</button></div>` },
    } } })
    const history = () => wrapper.get('[aria-label="Encounter event history"]').text()
    expect(history()).toContain('Damage')
    expect(history().indexOf('Guard takes damage')).toBeLessThan(history().indexOf('An earlier note'))
    await wrapper.get('[aria-label="Show oldest first"]').trigger('click')
    expect(history().indexOf('An earlier note')).toBeLessThan(history().indexOf('Guard takes damage'))
    await wrapper.findAll('button').find(button => button.text() === 'Note')!.trigger('click')
    expect(history()).toContain('An earlier note')
    expect(history()).not.toContain('Guard takes damage')
    await wrapper.findAll('button').find(button => button.text() === 'Clear filters')!.trigger('click')
    await wrapper.findAll('button').find(button => button.text() === 'Condition')!.trigger('click')
    expect(wrapper.text()).toContain('No events match these filters.')
    await wrapper.findAll('button').find(button => button.text() === 'Clear filters')!.trigger('click')
    expect(history()).toContain('Guard takes damage')
    expect(events[0]?.id).toBe('old')
    await wrapper.setProps({ events: [{ ...events[1]!, summary: 'Guard regains HP', payload: { action: 'hp.heal' } }] })
    expect(history()).toContain('Healing')
    expect(history()).not.toContain('Damage')
    await wrapper.setProps({ events: [] })
    expect(wrapper.text()).toContain('No encounter events yet.')
  })
})
