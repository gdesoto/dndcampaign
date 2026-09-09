<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: string
  saving: boolean
  error: string
  updatedAtLabel: string
  readonly?: boolean
  dirty?: boolean
  busy?: boolean
}>(), { dirty: false, busy: false })
const emit = defineEmits<{ 'update:value': [value: string]; save: []; discard: [] }>()
const editing = ref(false)
const expanded = ref(false)
const editButton = useTemplateRef('editButton')
const valueModel = computed({ get: () => props.value, set: (value: string) => emit('update:value', value) })
const { confirmDiscard } = useUnsavedChanges(() => props.dirty, () => props.busy || props.saving)
const finishEditing = async () => {
  editing.value = false
  await nextTick()
  editButton.value?.$el?.focus()
}
const cancel = async () => {
  if (!await confirmDiscard()) return
  emit('discard')
  await finishEditing()
}
watch(() => props.saving, (saving, wasSaving) => {
  if (wasSaving && !saving && !props.error && !props.dirty) void finishEditing()
})
</script>

<template>
  <UCard variant="soft">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="type-section">Where we left off</h2>
        <UTooltip v-if="!readonly && !editing" text="Edit status">
          <UButton ref="editButton" icon="i-lucide-pencil" color="neutral" variant="ghost" aria-label="Edit status" :disabled="busy" @click="editing = true" />
        </UTooltip>
      </div>
    </template>
    <div v-if="editing" class="space-y-3">
      <UFormField label="Current story status" name="currentStatus">
        <UTextarea v-model="valueModel" autofocus :rows="10" :disabled="readonly || busy || saving" placeholder="Where did we last leave the party?" />
      </UFormField>
      <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <span class="mr-auto text-xs text-muted">{{ dirty ? 'Unsaved changes' : 'No changes to save' }}</span>
        <UButton color="neutral" variant="outline" :disabled="busy || saving" @click="cancel">Cancel</UButton>
        <UButton color="primary" variant="solid" :loading="saving" :disabled="readonly || busy || saving || !dirty" @click="emit('save')">Save status</UButton>
      </div>
    </div>
    <div v-else class="space-y-3">
      <p class="reading-copy whitespace-pre-line text-default" :class="!expanded && value.length > 500 ? 'line-clamp-12' : ''">{{ value || 'No story status yet.' }}</p>
      <UButton v-if="value.length > 500" color="neutral" variant="ghost" size="sm" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Show less' : 'Read full status' }}</UButton>
    </div>
    <template #footer><p class="text-xs tabular-nums text-muted">Campaign updated {{ updatedAtLabel }}</p></template>
  </UCard>
</template>
