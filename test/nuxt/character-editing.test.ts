import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from '#imports'
import CharacterPage from '../../app/pages/characters/[characterId].vue'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
mockNuxtImport('useApi', () => () => ({ request }))
mockNuxtImport('useRoute', original => () => ({ ...original(), params: { characterId: 'ch1' } }))

beforeEach(() => {
  clearNuxtData()
  clearNuxtState()
  request.mockReset()
})

describe('character sheet editing', () => {
  it('locks the sheet during Done editing, retains failed edits, and saves them on retry', async () => {
    const character = {
      id: 'ch1', name: 'Aria', canEdit: true, isOwner: true, campaignLinks: [],
      sheetJson: { basics: { name: 'Aria' }, abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
    }
    let releaseSave!: () => void
    const delayedSave = new Promise<void>(resolve => { releaseSave = resolve })
    let failAbilities = true
    request.mockImplementation(async (url: string, options?: { method?: string; body?: { name?: string; section?: string; payload?: unknown } }) => {
      if (url === '/api/campaigns') return []
      if (url !== '/api/characters/ch1') throw new Error(`Unexpected request: ${url}`)
      if (options?.method === 'PATCH') {
        const body = options.body!
        if (body.name) {
          await delayedSave
          character.name = body.name
        }
        if (body.section === 'BASICS') character.sheetJson.basics = body.payload as typeof character.sheetJson.basics
        if (body.section === 'ABILITY_SCORES') {
          if (failAbilities) throw new Error('Unable to save abilities.')
          character.sheetJson.abilityScores = body.payload as typeof character.sheetJson.abilityScores
        }
      }
      return structuredClone(character)
    })
    const wrapper = await mountSuspended(CharacterPage, { global: { stubs: {
      UTooltip: { template: '<span><slot /></span>' }, CharactersImportModal: true,
    } } })
    const button = (label: string) => wrapper.findAll('button').find(item => item.text().trim() === label)!
    const name = () => wrapper.get('input#field-characters--characterId--vue-1')
    const strength = () => wrapper.get('input[aria-label="STR ability score"]')
    const writes = () => request.mock.calls.filter(([, options]) => options?.method === 'PATCH')

    await button('Edit sheet').trigger('click')
    await name().setValue('Aria Storm')
    await strength().setValue('18')
    await button('Done editing').trigger('click')
    await flushPromises()

    // Happy DOM does not include inherited fieldset disabling in :disabled.
    const disabled = (element: Element) => Boolean(element.closest(':disabled, fieldset[disabled]'))
    for (const control of [name(), strength(), wrapper.get('input[aria-label="New prepared spell"]'), button('Import'), button('Delete'), button('Save abilities')]) {
      expect(disabled(control.element)).toBe(true)
    }
    await button('Done editing').trigger('click')
    expect(writes()).toHaveLength(1)

    releaseSave()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Unable to save abilities.'))
    expect(disabled(strength().element)).toBe(false)
    expect(disabled(button('Import').element)).toBe(false)
    expect((name().element as HTMLInputElement).value).toBe('Aria Storm')
    expect((strength().element as HTMLInputElement).value).toBe('18')
    expect(button('Done editing')).toBeDefined()

    failAbilities = false
    await button('Done editing').trigger('click')
    await vi.waitFor(() => expect(button('Edit sheet')).toBeDefined())
    expect(character.sheetJson.abilityScores.str).toBe(18)
    expect(wrapper.text()).not.toContain('Unable to save abilities.')
    expect(writes().map(([, options]) => options.body.section || 'NAME')).toEqual(['NAME', 'BASICS', 'ABILITY_SCORES', 'ABILITY_SCORES'])
    wrapper.unmount()
  })
})
