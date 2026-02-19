<script setup lang="ts">
type CampaignEditForm = {
  name: string
  system: string
  dungeonMasterName: string
  description: string
}

const props = defineProps<{
  open: boolean
  form: CampaignEditForm
  saving: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: CampaignEditForm]
  save: []
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const updateFormField = <K extends keyof CampaignEditForm>(
  key: K,
  value: CampaignEditForm[K]
) => {
  emit('update:form', {
    ...props.form,
    [key]: value,
  })
}

const nameModel = computed({
  get: () => props.form.name,
  set: (value: string) => updateFormField('name', value),
})

const systemModel = computed({
  get: () => props.form.system,
  set: (value: string) => updateFormField('system', value),
})

const dungeonMasterNameModel = computed({
  get: () => props.form.dungeonMasterName,
  set: (value: string) => updateFormField('dungeonMasterName', value),
})

const descriptionModel = computed({
  get: () => props.form.description,
  set: (value: string) => updateFormField('description', value),
})
</script>

<template>
  <SharedEntityFormModal
    v-model:open="openModel"
    title="Edit campaign"
    :saving="saving"
    :error="error"
    submit-label="Save changes"
    @submit="emit('save')"
  >
    <UFormField label="Name" name="name">
      <UInput v-model="nameModel" />
    </UFormField>
    <UFormField label="System" name="system">
      <UInput v-model="systemModel" />
    </UFormField>
    <UFormField label="Dungeon master" name="dungeonMasterName">
      <UInput v-model="dungeonMasterNameModel" placeholder="DM name" />
    </UFormField>
    <UFormField label="Description" name="description">
      <UTextarea v-model="descriptionModel" :rows="5" />
    </UFormField>
  </SharedEntityFormModal>
</template>
