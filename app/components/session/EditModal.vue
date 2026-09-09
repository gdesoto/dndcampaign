<script setup lang="ts">
import { sessionFormSchema } from '~/utils/entity-form-schemas'
type SessionEditFormState = {
  title: string
  sessionNumber: string
  playedAt: string
  guestDungeonMasterName: string
  notes: string
}

const props = defineProps<{
  open: boolean
  form: SessionEditFormState
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: SessionEditFormState]
  save: []
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const submit = () => {
  emit('save')
}
</script>

<template>
  <SharedEntityFormModal v-model:open="openModel" :schema="sessionFormSchema" :state="form" title="Edit session" :saving="saving" :error="error" submit-label="Save changes" @submit="submit">
    <SessionFormFields :form="form" @update:form="emit('update:form', $event)" />
  </SharedEntityFormModal>
</template>
