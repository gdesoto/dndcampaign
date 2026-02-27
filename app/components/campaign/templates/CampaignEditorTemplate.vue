<script setup lang="ts">
type EditorTab = 'write' | 'preview'

const props = withDefaults(defineProps<{
  modelValue: string
  tab: EditorTab
  placeholder?: string
  rows?: number
  disabled?: boolean
}>(), {
  placeholder: '',
  rows: 12,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:tab': [value: EditorTab]
}>()

const editorTabs = [
  { label: 'Write', value: 'write' },
  { label: 'Preview', value: 'preview' },
]
</script>

<template>
  <div class="space-y-3">
    <UTabs
      :model-value="props.tab"
      :items="editorTabs"
      :content="false"
      @update:model-value="emit('update:tab', $event as EditorTab)"
    />

    <div class="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-3">
      <UTextarea
        v-if="props.tab === 'write'"
        :model-value="props.modelValue"
        :rows="props.rows"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @update:model-value="emit('update:modelValue', $event as string)"
      />

      <div v-else class="prose prose-sm max-w-none">
        <MDC :value="props.modelValue || '_No content yet._'" tag="article" />
      </div>
    </div>
  </div>
</template>
