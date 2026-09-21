import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import Form from '../../app/components/account/api-keys/Form.vue'

const campaigns = [{ id: 'campaign-1', name: 'The Old Road' }]

const mountForm = () => mountSuspended(Form, {
  props: { campaigns },
  global: {
    stubs: {
      UForm: { emits: ['submit'], template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
      UFormField: { props: ['label', 'description'], template: '<label><span>{{ label }}</span><slot /></label>' },
      UInput: {
        props: ['modelValue', 'type'],
        emits: ['update:modelValue'],
        template: '<input :type="type || \'text\'" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
      },
      USelectMenu: {
        props: ['modelValue', 'items'],
        emits: ['update:modelValue'],
        template: '<select multiple @change="$emit(\'update:modelValue\', items.map(item => item.id))"><option v-for="item in items" :key="item.id">{{ item.name }}</option></select>',
      },
      USwitch: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        template: '<button type="button" @click="$emit(\'update:modelValue\', !modelValue)">switch</button>',
      },
      UButton: { template: '<button type="submit"><slot /></button>' },
      UAlert: { props: ['description'], template: '<div role="alert">{{ description }}<slot /></div>' },
    },
  },
})

describe('account API key form', () => {
  it('requires a name, campaigns, and at least one permission', async () => {
    const wrapper = await mountForm()
    await wrapper.find('form').trigger('submit')
    expect(wrapper.text()).toContain('Enter a name for this API key.')
  })

  it('emits the draft with independent access controls', async () => {
    const wrapper = await mountForm()
    await wrapper.find('input').setValue('Road assistant')
    await wrapper.find('select').trigger('change')
    await wrapper.find('button[type="button"]').trigger('click')
    await wrapper.find('form').trigger('submit')

    const submission = wrapper.emitted('submit')?.[0]?.[0] as { name: string; campaignIds: string[]; permissions: Record<string, { read: boolean; write: boolean }> }
    expect(submission.name).toBe('Road assistant')
    expect(submission.campaignIds).toEqual(['campaign-1'])
    expect(submission.permissions.campaign?.read).toBe(true)
    expect(submission.permissions.campaign?.write).toBe(false)
  })
})
