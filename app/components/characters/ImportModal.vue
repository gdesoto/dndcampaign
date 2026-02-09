<script setup lang="ts">
import {
  characterImportSectionItems,
  type CharacterImportMode,
  type CharacterImportPayload,
  type CharacterImportRefreshPayload,
} from '~/utils/character-import'

const props = withDefaults(
  defineProps<{
    open: boolean
    loading?: boolean
    error?: string
    defaultMode?: CharacterImportMode
    showRefreshButton?: boolean
  }>(),
  {
    loading: false,
    error: '',
    defaultMode: 'SECTIONS',
    showRefreshButton: false,
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: CharacterImportPayload]
  refresh: [payload: CharacterImportRefreshPayload]
}>()

const form = reactive<{
  externalId: string
  overwriteMode: CharacterImportMode
  sections: CharacterImportRefreshPayload['sections']
}>({
  externalId: '',
  overwriteMode: props.defaultMode,
  sections: characterImportSectionItems.map((item) => item.value),
})

const resetForm = () => {
  form.externalId = ''
  form.overwriteMode = props.defaultMode
  form.sections = characterImportSectionItems.map((item) => item.value)
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetForm()
  }
)

const close = () => emit('update:open', false)

const submitImport = () => {
  emit('submit', {
    provider: 'DND_BEYOND',
    externalId: form.externalId,
    overwriteMode: form.overwriteMode,
    sections: [...form.sections],
  })
}

const refreshImport = () => {
  emit('refresh', {
    overwriteMode: form.overwriteMode,
    sections: [...form.sections],
  })
}
</script>

<template>
  <UModal
    :open="open"
    title="Import from D&amp;D Beyond"
    description="Provide a character ID and choose an import mode."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          help="Make sure the 'Character Privacy' setting for the character is set to Public."
        >
          <template #label>
            <div class="flex items-center gap-1">
              <span>Character ID</span>
              <UTooltip
                text="Character ID can be found in the DnD Beyond URL link for your character."
              >
                <UIcon name="i-lucide-info" class="h-4 w-4 text-dimmed" />
              </UTooltip>
            </div>
          </template>
          <UInput v-model="form.externalId" placeholder="e.g. 135280063" />
        </UFormField>

        <div>
          <label class="mb-2 block text-sm text-muted">Import mode</label>
          <USelect
            v-model="form.overwriteMode"
            :items="[
              { label: 'Section import', value: 'SECTIONS' },
              { label: 'Full import', value: 'FULL' },
            ]"
          />
        </div>

        <div>
          <label class="mb-2 block text-sm text-muted">Sections to import</label>
          <UCheckboxGroup
            v-model="form.sections"
            :items="characterImportSectionItems"
            variant="list"
          />
        </div>

        <div v-if="showRefreshButton" class="flex gap-2">
          <UButton :loading="loading" variant="outline" @click="refreshImport">
            Refresh with last import
          </UButton>
          <UButton :loading="loading" @click="submitImport">Import</UButton>
        </div>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>
      </div>
    </template>

    <template v-if="!showRefreshButton" #footer>
      <div class="flex justify-end gap-3">
        <UButton variant="ghost" color="gray" @click="close">Cancel</UButton>
        <UButton :loading="loading" @click="submitImport">Import</UButton>
      </div>
    </template>
  </UModal>
</template>
