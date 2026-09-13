import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { UApp } from '#components'
import EntityFormModal from '../../app/components/shared/EntityFormModal.vue'

describe('unsaved form cancellation', () => {
  it('shows a confirmation, preserves edits on Keep editing, and closes on Discard changes', async () => {
    const Harness = defineComponent({
      components: { UApp, EntityFormModal },
      setup: () => ({ open: ref(true), state: ref({ title: '' }) }),
      template: `<UApp><EntityFormModal v-model:open="open" :state="state" title="Create item">
        <input v-model="state.title" aria-label="Title" />
      </EntityFormModal></UApp>`,
    })
    const wrapper = await mountSuspended(Harness, {
      global: { stubs: {
        UModal: {
          props: ['open'],
          template: '<div v-if="open" role="dialog"><slot name="body" /></div>',
        },
      } },
    })
    const click = async (label: string) => {
      const button = wrapper.findAll('button').find(button => button.text() === label)
      expect(button, `Expected visible ${label} button`).toBeDefined()
      await button!.trigger('click')
      await flushPromises()
    }
    try {
      await wrapper.get('input').setValue('Changed draft')
      await click('Cancel')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2)
      await click('Keep editing')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
      expect(wrapper.get('input').element.value).toBe('Changed draft')
      await click('Cancel')
      await click('Discard changes')
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(0)
    }
    finally {
      wrapper.unmount()
    }
  })
})
