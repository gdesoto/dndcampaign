<script setup lang="ts">
type SuggestionItem = {
  id: string
  entityType: string
  action: string
  status: string
  payload: Record<string, unknown>
}

type SuggestionGroup = {
  label: string
  items: SuggestionItem[]
}

type SessionSuggestion = SuggestionItem | null

defineProps<{
  suggestionGroups: SuggestionGroup[]
  sessionSuggestion: SessionSuggestion
}>()

const emit = defineEmits<{
  'apply-suggestion': [input: { suggestionId: string; payload: Record<string, unknown> }]
  'discard-suggestion': [suggestionId: string]
}>()

const drafts = reactive<Record<string, Record<string, unknown>>>({})

const isPrimitive = (value: unknown) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const toDraftPayload = (payload: Record<string, unknown>) => {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (isPrimitive(value)) {
      next[key] = value
    }
  }
  return next
}

const ensureDraft = (suggestion: SuggestionItem) => {
  const base = toDraftPayload(suggestion.payload)
  const existing = drafts[suggestion.id] || {}
  const merged: Record<string, unknown> = {}
  for (const key of Object.keys(base)) {
    merged[key] = key in existing ? existing[key] : base[key]
  }
  drafts[suggestion.id] = merged
  return merged
}

const editableFields = (suggestion: SuggestionItem) =>
  Object.entries(ensureDraft(suggestion)).filter(([field]) => field !== 'type')

const updateField = (suggestionId: string, key: string, value: unknown) => {
  if (!drafts[suggestionId]) drafts[suggestionId] = {}
  drafts[suggestionId][key] = value
}

const enumOptionsFor = (suggestion: SuggestionItem, field: string) => {
  if (suggestion.entityType === 'QUEST' && field === 'status') {
    return [
      { label: 'ACTIVE', value: 'ACTIVE' },
      { label: 'COMPLETED', value: 'COMPLETED' },
      { label: 'FAILED', value: 'FAILED' },
      { label: 'ON_HOLD', value: 'ON_HOLD' },
    ]
  }
  if (suggestion.entityType === 'QUEST' && field === 'type') {
    return [
      { label: 'MAIN', value: 'MAIN' },
      { label: 'SIDE', value: 'SIDE' },
      { label: 'PLAYER', value: 'PLAYER' },
    ]
  }
  return null
}

const applySuggestion = (suggestion: SuggestionItem) => {
  const payload = {
    ...suggestion.payload,
    ...ensureDraft(suggestion),
  }
  emit('apply-suggestion', { suggestionId: suggestion.id, payload })
}

const applySessionField = (suggestion: SuggestionItem, field: 'title' | 'notes') => {
  const draft = ensureDraft(suggestion)
  if (typeof draft[field] !== 'string') return
  emit('apply-suggestion', {
    suggestionId: suggestion.id,
    payload: {
      [field]: draft[field],
    },
  })
}

const suggestionTitle = (suggestion: SuggestionItem) => {
  if (typeof suggestion.payload.title === 'string') return suggestion.payload.title
  if (typeof suggestion.payload.name === 'string') return suggestion.payload.name
  if (typeof suggestion.payload.summary === 'string') return suggestion.payload.summary
  return 'Suggestion'
}
</script>

<template>
  <div v-if="suggestionGroups.length" class="space-y-3">
    <div
      v-if="sessionSuggestion"
      class="rounded-lg border border-default bg-elevated/20 p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold">Session suggestion</p>
        <UBadge variant="soft" color="primary" size="sm">
          {{ sessionSuggestion.action }}
        </UBadge>
      </div>
      <div class="mt-3 space-y-2 text-sm text-muted">
        <div v-if="sessionSuggestion.payload.title || drafts[sessionSuggestion.id]?.title !== undefined">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Title</p>
          <UInput
            :model-value="String(ensureDraft(sessionSuggestion).title || '')"
            class="mt-1"
            @update:model-value="updateField(sessionSuggestion.id, 'title', $event)"
          />
        </div>
        <div v-if="sessionSuggestion.payload.notes || drafts[sessionSuggestion.id]?.notes !== undefined">
          <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Notes</p>
          <UTextarea
            :model-value="String(ensureDraft(sessionSuggestion).notes || '')"
            :rows="4"
            class="mt-1"
            @update:model-value="updateField(sessionSuggestion.id, 'notes', $event)"
          />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          size="xs"
          variant="outline"
          :disabled="sessionSuggestion.status !== 'PENDING' || typeof ensureDraft(sessionSuggestion).title !== 'string'"
          @click="applySessionField(sessionSuggestion, 'title')"
        >
          Apply title
        </UButton>
        <UButton
          size="xs"
          variant="outline"
          :disabled="sessionSuggestion.status !== 'PENDING' || typeof ensureDraft(sessionSuggestion).notes !== 'string'"
          @click="applySessionField(sessionSuggestion, 'notes')"
        >
          Apply notes
        </UButton>
        <UButton
          size="xs"
          variant="outline"
          :disabled="sessionSuggestion.status !== 'PENDING'"
          @click="applySuggestion(sessionSuggestion)"
        >
          Apply
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          :disabled="sessionSuggestion.status !== 'PENDING'"
          @click="emit('discard-suggestion', sessionSuggestion.id)"
        >
          Discard
        </UButton>
      </div>
    </div>

    <div
      v-for="group in suggestionGroups"
      :key="group.label"
      class="rounded-lg border border-default bg-elevated/20 p-4"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-sm font-semibold">{{ group.label }}</p>
        <UBadge variant="soft" color="primary" size="sm">
          {{ group.items.length }}
        </UBadge>
      </div>
      <div class="mt-3 space-y-3">
        <div
          v-for="suggestion in group.items"
          :key="suggestion.id"
          class="rounded-md border border-default bg-background/60 p-3"
        >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-sm font-semibold">{{ suggestionTitle(suggestion) }}</p>
                <p class="text-xs text-muted">
                  {{ suggestion.action }} · {{ suggestion.status }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="xs"
                  variant="outline"
                  :disabled="suggestion.status !== 'PENDING'"
                  @click="applySuggestion(suggestion)"
                >
                  Apply
                </UButton>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                :disabled="suggestion.status !== 'PENDING'"
                @click="emit('discard-suggestion', suggestion.id)"
              >
                Discard
              </UButton>
              </div>
            </div>
            <div class="mt-3 space-y-2">
              <div
                v-for="[field, fieldValue] in editableFields(suggestion)"
                :key="`${suggestion.id}-${field}`"
              >
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ field }}</p>
                <UTextarea
                  v-if="typeof fieldValue === 'string' && (fieldValue.length > 40 || field.includes('description') || field.includes('notes'))"
                  :model-value="String(fieldValue)"
                  :rows="3"
                  class="mt-1"
                  @update:model-value="updateField(suggestion.id, field, $event)"
                />
                <USelect
                  v-else-if="typeof fieldValue === 'string' && enumOptionsFor(suggestion, field)"
                  :items="enumOptionsFor(suggestion, field)!"
                  :model-value="String(fieldValue)"
                  class="mt-1"
                  @update:model-value="updateField(suggestion.id, field, String($event || ''))"
                />
                <UInput
                  v-else-if="typeof fieldValue === 'string'"
                  :model-value="String(fieldValue)"
                  class="mt-1"
                  @update:model-value="updateField(suggestion.id, field, $event)"
                />
                <UInput
                  v-else-if="typeof fieldValue === 'number'"
                  :model-value="String(fieldValue)"
                  type="number"
                  class="mt-1"
                  @update:model-value="updateField(suggestion.id, field, Number($event))"
                />
                <div v-else-if="typeof fieldValue === 'boolean'" class="mt-1">
                  <UCheckbox
                    :model-value="Boolean(fieldValue)"
                    @update:model-value="updateField(suggestion.id, field, Boolean($event))"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  </div>
</template>

