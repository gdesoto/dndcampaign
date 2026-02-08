import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatusEditor from '../../app/components/campaign/StatusEditor.vue'

describe('CampaignStatusEditor', () => {
  it('emits save and value updates', async () => {
    const wrapper = await mountSuspended(StatusEditor, {
      props: {
        value: 'Initial status',
        saving: false,
        error: '',
        updatedAtLabel: 'Today',
      },
    })

    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue('Updated status')

    const saveButton = wrapper.findAll('button').find((button) => button.text().trim() === 'Save status')
    expect(saveButton).toBeDefined()
    await saveButton!.trigger('click')

    expect(wrapper.emitted('update:value')?.at(-1)).toEqual(['Updated status'])
    expect(wrapper.emitted('save')).toBeTruthy()
  })
})
