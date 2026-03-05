<script setup lang="ts">
type SessionFormState = {
  title: string
  sessionNumber: string
  playedAt: string
  guestDungeonMasterName: string
  notes: string
}

const props = withDefaults(defineProps<{
  form: SessionFormState
  disabled?: boolean
  notesRows?: number
}>(), {
  disabled: false,
  notesRows: 6,
})

const emit = defineEmits<{
  'update:form': [value: SessionFormState]
}>()

const updateFormField = <K extends keyof SessionFormState>(
  key: K,
  value: SessionFormState[K]
) => {
  emit('update:form', {
    ...props.form,
    [key]: value,
  })
}

const titleModel = computed({
  get: () => props.form.title,
  set: (value: string) => updateFormField('title', value),
})

const sessionNumberModel = computed({
  get: () => props.form.sessionNumber,
  set: (value: string) => updateFormField('sessionNumber', value),
})

const playedAtModel = computed({
  get: () => props.form.playedAt,
  set: (value: string) => updateFormField('playedAt', value),
})

const guestDungeonMasterNameModel = computed({
  get: () => props.form.guestDungeonMasterName,
  set: (value: string) => updateFormField('guestDungeonMasterName', value),
})

const notesModel = computed({
  get: () => props.form.notes,
  set: (value: string) => updateFormField('notes', value),
})
</script>

<template>
  <UFormField label="Title" name="title">
    <UInput v-model="titleModel" :disabled="disabled" placeholder="This Is Why Taverns Have Rules" />
  </UFormField>

  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField label="Session number" name="sessionNumber">
      <UInput v-model="sessionNumberModel" :disabled="disabled" type="number" />
    </UFormField>
    <UFormField label="Played at" name="playedAt">
      <UInput v-model="playedAtModel" :disabled="disabled" type="date" />
    </UFormField>
  </div>

  <UFormField label="Guest dungeon master" name="guestDungeonMasterName">
    <UInput v-model="guestDungeonMasterNameModel" :disabled="disabled" placeholder="Optional guest DM" />
  </UFormField>

  <UFormField label="Notes" name="notes">
    <UTextarea v-model="notesModel" :disabled="disabled" :rows="notesRows" />
  </UFormField>
</template>
