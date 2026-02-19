<script setup lang="ts">
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

const updateFormField = <K extends keyof SessionEditFormState>(
  key: K,
  value: SessionEditFormState[K]
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

const submit = () => {
  emit('save')
}
</script>

<template>
  <UModal v-model:open="openModel">
    <template #content>
      <UCard>
        <template #header>
          <h2 class="text-lg font-semibold">Edit session</h2>
        </template>

        <UForm :state="form" class="space-y-4" @submit.prevent="submit">
          <UFormField label="Title" name="title">
            <UInput v-model="titleModel" placeholder="This Is Why Taverns Have Rules" />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Session number" name="sessionNumber">
              <UInput v-model="sessionNumberModel" type="number" />
            </UFormField>
            <UFormField label="Played at" name="playedAt">
              <UInput v-model="playedAtModel" type="date" />
            </UFormField>
          </div>

          <UFormField label="Guest dungeon master" name="guestDungeonMasterName">
            <UInput v-model="guestDungeonMasterNameModel" placeholder="Optional guest DM" />
          </UFormField>

          <UFormField label="Notes" name="notes">
            <UTextarea v-model="notesModel" :rows="6" />
          </UFormField>

          <p v-if="error" class="text-sm text-error">{{ error }}</p>

          <div class="flex justify-end gap-3">
            <UButton variant="ghost" color="neutral" @click="openModel = false">Cancel</UButton>
            <UButton type="submit" :loading="saving">Save session</UButton>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>

