<script setup lang="ts">
const props = defineProps<{
  name: string
  primary: boolean
  files: File[] | null
  importing: boolean
  errorMessage: string
  primaryDisabled: boolean
}>()

const emit = defineEmits<{
  'update:name': [value: string]
  'update:primary': [value: boolean]
  'update:files': [value: File[] | null]
  submit: []
}>()

const importNameModel = computed({
  get: () => props.name,
  set: (value: string) => emit('update:name', value),
})

const importPrimaryModel = computed({
  get: () => props.primary,
  set: (value: boolean) => emit('update:primary', value),
})

const importFilesModel = computed({
  get: () => props.files,
  set: (value: File[] | null) => emit('update:files', value),
})
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 lg:grid-cols-3">
      <UFormField label="Map name (optional)">
        <UInput v-model="importNameModel" placeholder="Chronosia" />
      </UFormField>
      <UFormField label="Primary map">
        <UCheckbox
          v-model="importPrimaryModel"
          label="Set as primary map"
          :disabled="primaryDisabled"
        />
      </UFormField>
      <div class="lg:col-span-3">
        <UFileUpload
          v-model="importFilesModel"
          multiple
          label="Upload Full JSON + optional SVG/GeoJSON artifacts"
          description="Required: Azgaar Full JSON. Optional: SVG, markers/rivers/routes/cells GeoJSON."
          accept=".json,.geojson,.svg"
        />
      </div>
    </div>
    <div class="flex items-center gap-3">
      <UButton :loading="importing" @click="emit('submit')">Import map</UButton>
      <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
    </div>
  </div>
</template>
