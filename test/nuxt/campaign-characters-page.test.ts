import { beforeEach, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import CharactersPage from '../../app/pages/campaigns/[campaignId]/characters.vue'

const request = vi.fn()
const refresh = vi.fn()
const canWrite = ref(true)
const links = ref([{ id: 'link-1', status: 'ACTIVE', character: { id: 'c1', name: 'Attached hero', canEdit: true, isOwner: true } }])
mockNuxtImport('useCampaignPageContext', () => () => ({ campaignId: computed(() => 'campaign-1'), request, canWriteContent: canWrite }))
mockNuxtImport('useAsyncData', () => (key: string | (() => string)) => ({
  data: typeof key === 'string' ? ref([{ id: 'c1', name: 'Attached hero', canEdit: true }, { id: 'c2', name: 'Available hero', canEdit: true }]) : links,
  pending: ref(false), error: ref(null), refresh,
}))
const global = { stubs: {
  UTooltip: { template: '<div><slot /></div>' },
  USelectMenu: { props: ['items', 'modelValue', 'disabled'], emits: ['update:modelValue'], template: '<select :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="">Select character</option><option v-for="item in items" :key="item.id" :value="item.id">{{ item.name }}</option></select>' },
} }
beforeEach(() => { vi.clearAllMocks(); canWrite.value = true })

it('excludes attached characters and preserves selection after a failed attachment', async () => {
  request.mockRejectedValue(new Error('Unable to attach'))
  const wrapper = await mountSuspended(CharactersPage, { global })
  expect(wrapper.findAll('option').map(option => option.text())).toEqual(['Select character', 'Available hero'])
  await wrapper.find('select').setValue('c2')
  await wrapper.findAll('button').find(button => button.text().includes('Add to campaign'))!.trigger('click')
  await flushPromises()
  expect(request).toHaveBeenCalledWith('/api/campaigns/campaign-1/characters', { method: 'POST', body: { characterId: 'c2' } })
  expect(wrapper.find('[role="alert"]').text()).toContain('Unable to attach')
  expect(wrapper.find('select').element.value).toBe('c2')
  wrapper.unmount()
})

it('keeps character sheets available without attachment controls for viewers', async () => {
  canWrite.value = false
  const wrapper = await mountSuspended(CharactersPage, { global })
  expect(wrapper.find('select').exists()).toBe(false)
  expect(wrapper.find('a[href="/characters/c1"]').text()).toBe('Attached hero')
  wrapper.unmount()
})
