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
          <SessionFormFields
            :form="form"
            @update:form="emit('update:form', $event)"
          />

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

