import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatusEditor from '../../app/components/campaign/StatusEditor.vue'

describe('CampaignStatusEditor', () => {
  it('emits save and value updates', async () => {
    const wrapper = await mountSuspended(StatusEditor, {
      global: { stubs: { UTooltip: { template: '<slot />' } } },
      props: {
        value: 'Initial status',
        saving: false,
        error: '',
        updatedAtLabel: 'Today',
      },
    })

    expect(wrapper.find('textarea').exists()).toBe(false)
    await wrapper.find('button[aria-label="Edit status"]').trigger('click')
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('Updated status')
    await wrapper.setProps({ value: 'Updated status', dirty: true })

    const saveButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Save status')
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['Updated status'])
    expect(wrapper.emitted('save')).toBeTruthy()
    await wrapper.setProps({ saving: true })
    await wrapper.setProps({ saving: false, error: 'Save failed' })
    expect(wrapper.find('textarea').element.value).toBe('Updated status')
    expect(wrapper.text()).toContain('Save failed')
    await wrapper.setProps({ saving: true, error: '' })
    await wrapper.setProps({ saving: false, dirty: false })
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })
  it('does not offer editing to read-only users', async () => {
    const wrapper = await mountSuspended(StatusEditor, { props: { value: 'Story', saving: false, error: '', updatedAtLabel: 'Today', readonly: true } })
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="Edit status"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
