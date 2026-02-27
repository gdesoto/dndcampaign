<script setup lang="ts">
import type { CampaignJournalVisibilityInput } from '#shared/schemas/campaign-journal'
import CampaignEditorTemplate from '~/components/campaign/templates/CampaignEditorTemplate.vue'

type EditorTab = 'write' | 'preview'

withDefaults(defineProps<{
  title: string
  titleDisabled?: boolean
  visibility: CampaignJournalVisibilityInput
  visibilityItems: Array<{ label: string; value: string }>
  sessionIds: string[]
  sessionItems: Array<{ id: string; label: string }>
  sessionDisabled?: boolean
  contentMarkdown: string
  markdownDisabled?: boolean
  editorTab: EditorTab
  editorRows?: number
  canManageDiscoverables: boolean
  discoverable: boolean
  holderUserId: string
  memberItems: Array<{ value: string; label: string }>
  unassignedHolderValue: string
  unresolvedGlossaryMentions?: string[]
  extractedCustomTags?: string[]
  extractedGlossaryMentions?: string[]
  showTagInsights?: boolean
  showMarkdown?: boolean
}>(), {
  titleDisabled: false,
  sessionDisabled: false,
  markdownDisabled: false,
  editorRows: 8,
  unresolvedGlossaryMentions: () => [],
  extractedCustomTags: () => [],
  extractedGlossaryMentions: () => [],
  showTagInsights: true,
  showMarkdown: true,
})

const emit = defineEmits<{
  'update:title': [value: string]
  'update:visibility': [value: CampaignJournalVisibilityInput]
  'update:sessionIds': [value: string[]]
  'update:contentMarkdown': [value: string]
  'update:editorTab': [value: EditorTab]
  'update:discoverable': [value: boolean]
  'update:holderUserId': [value: string]
}>()
</script>

<template>
  <UFormField label="Title" name="title" required>
    <UInput
      :model-value="title"
      :disabled="titleDisabled"
      @update:model-value="emit('update:title', $event as string)"
    />
  </UFormField>

  <UFormField label="Visibility" name="visibility" required>
    <USelect
      :model-value="visibility"
      class="w-full"
      :items="visibilityItems"
      @update:model-value="emit('update:visibility', $event as CampaignJournalVisibilityInput)"
    />
  </UFormField>

  <UFormField label="Linked sessions" name="sessionIds">
    <UInputMenu
      :model-value="sessionIds"
      class="w-full min-w-0"
      multiple
      value-key="id"
      label-key="label"
      :items="sessionItems"
      placeholder="Select sessions"
      :disabled="sessionDisabled"
      @update:model-value="emit('update:sessionIds', $event as string[])"
    />
  </UFormField>

  <div v-if="canManageDiscoverables || discoverable" class="mb-3 space-y-3">
    <p class="text-sm font-semibold">DM Options</p>
    <UCheckbox
      v-if="canManageDiscoverables"
      :model-value="discoverable"
      label="Mark as discoverable"
      @update:model-value="emit('update:discoverable', $event as boolean)"
    />
    <template v-if="discoverable">
      <UFormField v-if="canManageDiscoverables" label="Holder" name="holderUserId">
        <USelect
          :model-value="holderUserId"
          class="w-full"
          :items="[{ label: 'Unassigned', value: unassignedHolderValue }, ...memberItems]"
          placeholder="Assign holder"
          @update:model-value="emit('update:holderUserId', $event as string)"
        />
      </UFormField>
    </template>
  </div>

  <UFormField v-if="showMarkdown" label="Entry markdown" name="contentMarkdown" required>
    <CampaignEditorTemplate
      :model-value="contentMarkdown"
      :tab="editorTab"
      :rows="editorRows"
      :disabled="markdownDisabled"
      placeholder="Use markdown with #tags and [[Glossary Name]] mentions."
      @update:model-value="emit('update:contentMarkdown', $event as string)"
      @update:tab="emit('update:editorTab', $event)"
    />
    <p class="mt-2 text-xs text-muted">
      Tag syntax: `#custom-tag` and `[[Glossary Name]]`
    </p>
  </UFormField>

  <template v-if="showMarkdown && showTagInsights">
    <UAlert
      v-if="unresolvedGlossaryMentions.length"
      color="warning"
      variant="subtle"
      title="Unresolved glossary mentions"
      :description="`No glossary entry matched: ${unresolvedGlossaryMentions.join(', ')}`"
    />

    <div
      v-if="extractedCustomTags.length || extractedGlossaryMentions.length"
      class="space-y-2"
    >
      <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Extracted tags</p>
      <div class="flex flex-wrap gap-2">
        <UBadge v-for="tag in extractedCustomTags" :key="`custom-${tag}`" color="neutral" variant="soft">
          #{{ tag }}
        </UBadge>
        <UBadge
          v-for="mention in extractedGlossaryMentions"
          :key="`mention-${mention}`"
          color="primary"
          variant="soft"
        >
          [[{{ mention }}]]
        </UBadge>
      </div>
    </div>
  </template>
</template>
