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
  save: []
}>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
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
      <UInput v-model="form.name" />
    </UFormField>
    <UFormField label="System" name="system">
      <UInput v-model="form.system" />
    </UFormField>
    <UFormField label="Dungeon master" name="dungeonMasterName">
      <UInput v-model="form.dungeonMasterName" placeholder="DM name" />
    </UFormField>
    <UFormField label="Description" name="description">
      <UTextarea v-model="form.description" :rows="5" />
    </UFormField>
  </SharedEntityFormModal>
</template>
