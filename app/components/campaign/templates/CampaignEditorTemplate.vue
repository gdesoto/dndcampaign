<script setup lang="ts">
type EditorTab = 'write' | 'preview'
type AutocompleteMode = 'tag' | 'glossary'

type AutocompleteContext = {
  mode: AutocompleteMode
  query: string
  tokenStart: number
  tokenEnd: number
}

const props = withDefaults(defineProps<{
  modelValue: string
  tab: EditorTab
  showTabs?: boolean
  placeholder?: string
  rows?: number
  disabled?: boolean
  enableAutocomplete?: boolean
  tagSuggestions?: string[]
  glossarySuggestions?: string[]
}>(), {
  showTabs: true,
  placeholder: '',
  rows: 12,
  disabled: false,
  enableAutocomplete: false,
  tagSuggestions: () => [],
  glossarySuggestions: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:tab': [value: EditorTab]
}>()

const editorTabs = [
  { label: 'Write', value: 'write' },
  { label: 'Preview', value: 'preview' },
]

const textareaContainer = ref<HTMLElement | null>(null)
const autocomplete = ref<AutocompleteContext | null>(null)

const resolveTextarea = () =>
  textareaContainer.value?.querySelector('textarea') as HTMLTextAreaElement | null

const parseAutocompleteContext = (value: string, caret: number): AutocompleteContext | null => {
  const prefix = value.slice(0, caret)

  const glossaryMatch = /\[\[([^[\]]*)$/.exec(prefix)
  if (glossaryMatch) {
    return {
      mode: 'glossary',
      query: glossaryMatch[1] || '',
      tokenStart: caret - glossaryMatch[0].length,
      tokenEnd: caret,
    }
  }

  const tagMatch = /(?:^|[\s(])#([A-Za-z0-9_-]*)$/.exec(prefix)
  if (tagMatch) {
    return {
      mode: 'tag',
      query: tagMatch[1] || '',
      tokenStart: caret - (tagMatch[1]?.length || 0) - 1,
      tokenEnd: caret,
    }
  }

  return null
}

const refreshAutocomplete = () => {
  if (!props.enableAutocomplete || props.disabled || (props.showTabs && props.tab !== 'write')) {
    autocomplete.value = null
    return
  }

  const textarea = resolveTextarea()
  if (!textarea) {
    autocomplete.value = null
    return
  }

  const caret = textarea.selectionStart ?? props.modelValue.length
  autocomplete.value = parseAutocompleteContext(props.modelValue || '', caret)
}

const filteredAutocompleteItems = computed(() => {
  const context = autocomplete.value
  if (!context) return []

  const source = context.mode === 'tag' ? props.tagSuggestions : props.glossarySuggestions
  const normalizedQuery = context.query.trim().toLowerCase()
  const ranked = source
    .filter((value) => value.trim().length > 0)
    .filter((value) => {
      if (!normalizedQuery) return true
      return value.toLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => a.localeCompare(b))

  return Array.from(new Set(ranked)).slice(0, 8)
})

const onModelValueUpdate = (value: string) => {
  emit('update:modelValue', value)
  nextTick(() => {
    refreshAutocomplete()
  })
}

const applyAutocomplete = (selectedValue: string) => {
  const context = autocomplete.value
  if (!context) return

  const replacement = context.mode === 'tag'
    ? `#${selectedValue}`
    : `[[${selectedValue}]]`

  const nextValue = `${props.modelValue.slice(0, context.tokenStart)}${replacement}${props.modelValue.slice(context.tokenEnd)}`
  emit('update:modelValue', nextValue)

  nextTick(() => {
    const textarea = resolveTextarea()
    if (textarea) {
      const nextCaret = context.tokenStart + replacement.length
      textarea.focus()
      textarea.setSelectionRange(nextCaret, nextCaret)
    }
    refreshAutocomplete()
  })
}

watch(() => props.tab, () => {
  nextTick(() => refreshAutocomplete())
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <UTabs
      v-if="props.showTabs"
      :model-value="props.tab"
      :items="editorTabs"
      :content="false"
      @update:model-value="emit('update:tab', $event as EditorTab)"
    />

    <div
      :class="props.showTabs
        ? 'flex min-h-0 flex-1 rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-3'
        : 'rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg-elevated)] p-3'"
    >
      <div
        v-if="!props.showTabs || props.tab === 'write'"
        ref="textareaContainer"
        class="w-full space-y-2"
      >
        <UTextarea
          :model-value="props.modelValue"
          class="w-full"
          :rows="props.showTabs ? props.rows : undefined"
          :autoresize="!props.showTabs"
          :placeholder="props.placeholder"
          :disabled="props.disabled"
          :ui="{ root: 'w-full', base: 'resize-none' }"
          @click="refreshAutocomplete"
          @keyup="refreshAutocomplete"
          @update:model-value="onModelValueUpdate($event as string)"
        />

        <div
          v-if="props.enableAutocomplete && autocomplete && filteredAutocompleteItems.length"
          class="rounded-md border border-[var(--ui-border)] bg-[var(--ui-bg)] p-2"
        >
          <p class="mb-1 text-xs text-dimmed">
            {{ autocomplete.mode === 'tag' ? 'Tag suggestions' : 'Glossary suggestions' }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in filteredAutocompleteItems"
              :key="`${autocomplete.mode}-${item}`"
              size="xs"
              variant="outline"
              @click="applyAutocomplete(item)"
            >
              {{ autocomplete.mode === 'tag' ? `#${item}` : `[[${item}]]` }}
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="prose prose-sm h-full max-w-none overflow-y-auto">
        <MDC :value="props.modelValue || '_No content yet._'" tag="article" />
      </div>
    </div>
  </div>
</template>
