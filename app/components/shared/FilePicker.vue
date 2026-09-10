<script setup lang="ts">
defineProps<{
  label: string
  accept: string
  disabled?: boolean
}>()

const file = defineModel<File | null>({ default: null })
</script>

<template>
  <div class="min-w-0 space-y-2">
    <UFileUpload
      v-model="file"
      :label="label"
      :accept="accept"
      :disabled="disabled"
      variant="area"
      layout="list"
      position="inside"
      :file-image="false"
      :file-delete="{ disabled, variant: 'ghost', color: 'neutral' }"
      :highlight="Boolean(file)"
      :ui="{ fileName: 'whitespace-normal wrap-anywhere', file: 'min-w-0' }"
      class="w-full"
    />
    <p role="status" class="flex items-center gap-1.5 text-xs" :class="file ? 'text-info' : 'text-muted'">
      <UIcon :name="file ? 'i-lucide-file-check-2' : 'i-lucide-paperclip'" class="size-4 shrink-0" aria-hidden="true" />
      {{ file ? 'File selected' : 'No file selected' }}
    </p>
  </div>
</template>
