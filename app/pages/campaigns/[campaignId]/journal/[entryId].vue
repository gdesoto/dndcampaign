<script setup lang="ts">
import type {
  CampaignJournalUpdateInput,
  CampaignJournalVisibilityInput,
} from '#shared/schemas/campaign-journal'
import { extractJournalTagCandidatesFromMarkdown } from '#shared/utils/campaign-journal-tags'

definePageMeta({ layout: 'default' })

type SessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
}

type GlossaryLite = {
  id: string
  name: string
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const entryId = computed(() => route.params.entryId as string)
const journalApi = useCampaignJournal()
const { request } = useApi()
const toast = useToast()

const {
  data: entry,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `journal-entry-${campaignId.value}-${entryId.value}`,
  () => journalApi.getEntry(campaignId.value, entryId.value),
  { watch: [entryId] },
)

const { data: sessions } = await useAsyncData(
  () => `journal-detail-sessions-${campaignId.value}`,
  () => request<SessionOption[]>(`/api/campaigns/${campaignId.value}/sessions`),
)

const { data: glossaryEntries } = await useAsyncData(
  () => `journal-detail-glossary-${campaignId.value}`,
  () => request<GlossaryLite[]>(`/api/campaigns/${campaignId.value}/glossary`),
)

const visibilityLabelMap: Record<CampaignJournalVisibilityInput, string> = {
  MYSELF: 'Myself',
  DM: 'DM',
  CAMPAIGN: 'Campaign',
}

const visibilityColor = (visibility: CampaignJournalVisibilityInput) => {
  if (visibility === 'CAMPAIGN') return 'primary'
  if (visibility === 'DM') return 'warning'
  return 'neutral'
}

const isEditOpen = ref(false)
const isSaving = ref(false)
const actionError = ref('')
const editorTab = ref<'write' | 'preview'>('write')

const form = reactive<CampaignJournalUpdateInput>({
  title: '',
  contentMarkdown: '',
  visibility: 'MYSELF',
  sessionIds: [],
})

const formSessionIds = computed({
  get: () => form.sessionIds || [],
  set: (value: string[]) => {
    form.sessionIds = value
  },
})

const sessionItems = computed(() =>
  (sessions.value || []).map((session) => ({
    id: session.id,
    label: session.sessionNumber
      ? `Session ${session.sessionNumber}: ${session.title}`
      : session.title,
  })),
)

const openEdit = () => {
  if (!entry.value?.canEdit) return
  actionError.value = ''
  form.title = entry.value.title
  form.contentMarkdown = entry.value.contentMarkdown
  form.visibility = entry.value.visibility
  form.sessionIds = entry.value.sessions.map((session) => session.sessionId)
  editorTab.value = 'write'
  isEditOpen.value = true
}

const glossaryNameSet = computed(() =>
  new Set((glossaryEntries.value || []).map((item) => item.name.trim().toLowerCase())),
)

const extractedCandidates = computed(() =>
  extractJournalTagCandidatesFromMarkdown(form.contentMarkdown || ''),
)

const unresolvedGlossaryMentions = computed(() =>
  extractedCandidates.value.glossaryMentions.filter(
    (mention) => !glossaryNameSet.value.has(mention.trim().toLowerCase()),
  ),
)

const saveEdit = async () => {
  if (!entry.value?.canEdit) return
  isSaving.value = true
  actionError.value = ''
  try {
    await journalApi.updateEntry(campaignId.value, entryId.value, {
      title: form.title,
      contentMarkdown: form.contentMarkdown,
      visibility: form.visibility,
      sessionIds: form.sessionIds || [],
    })
    isEditOpen.value = false
    await refresh()
    toast.add({
      title: 'Entry updated',
      description: 'Journal entry updated successfully.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to update entry.'
  } finally {
    isSaving.value = false
  }
}

const isDeleting = ref(false)
const deleteEntry = async () => {
  if (!entry.value?.canDelete) return
  isDeleting.value = true
  try {
    await journalApi.deleteEntry(campaignId.value, entryId.value)
    toast.add({
      title: 'Entry deleted',
      description: 'Journal entry removed.',
      color: 'success',
      icon: 'i-lucide-check',
    })
    await navigateTo(`/campaigns/${campaignId.value}/journal`)
  } catch (cause) {
    toast.add({
      title: 'Delete failed',
      description: (cause as Error).message || 'Unable to delete entry.',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <UButton
      variant="outline"
      icon="i-lucide-arrow-left"
      :to="`/campaigns/${campaignId}/journal`"
    >
      Back to journal
    </UButton>

    <SharedResourceState
      :pending="pending"
      :error="error"
      :empty="!entry"
      error-message="Unable to load journal entry."
      empty-message="Journal entry not found."
      @retry="refresh"
    >
      <template #loading>
        <UCard class="h-40 animate-pulse" />
      </template>

      <UPageHeader
        :title="entry?.title || 'Journal entry'"
        headline="Journal"
        :description="entry ? `By ${entry.authorName}` : ''"
      >
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              v-if="entry?.canEdit"
              size="sm"
              variant="outline"
              icon="i-lucide-pencil"
              @click="openEdit"
            >
              Edit
            </UButton>
            <SharedConfirmActionPopover
              v-if="entry?.canDelete"
              trigger-label="Delete"
              trigger-color="error"
              trigger-variant="outline"
              trigger-size="sm"
              trigger-icon="i-lucide-trash-2"
              trigger-aria-label="Delete journal entry"
              confirm-label="Delete"
              confirm-color="error"
              :confirm-loading="isDeleting"
              :message="`Delete '${entry.title}'? This action cannot be undone.`"
              @confirm="({ close }) => { deleteEntry(); close() }"
            />
          </div>
        </template>
      </UPageHeader>

      <UCard>
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="visibilityColor(entry!.visibility)" variant="soft">
            {{ visibilityLabelMap[entry!.visibility] }}
          </UBadge>
          <UBadge v-if="entry?.sessions.length" color="neutral" variant="soft">
            {{ entry.sessions.length }} linked session{{ entry.sessions.length === 1 ? '' : 's' }}
          </UBadge>
          <span class="text-xs text-muted">Updated {{ new Date(entry!.updatedAt).toLocaleString() }}</span>
        </div>

        <div v-if="entry?.sessions.length" class="mt-3 flex flex-wrap gap-2">
          <UBadge
            v-for="session in entry.sessions"
            :key="session.sessionId"
            color="neutral"
            variant="outline"
          >
            {{ session.sessionNumber ? `S${session.sessionNumber}` : 'Session' }}: {{ session.title }}
          </UBadge>
        </div>

        <div v-if="entry?.tags.length" class="mt-3 flex flex-wrap gap-2">
          <UBadge
            v-for="tag in entry.tags"
            :key="tag.id"
            variant="outline"
            color="primary"
          >
            {{ tag.tagType === 'CUSTOM' ? '#' : '[[' }}{{ tag.displayLabel }}{{ tag.tagType === 'CUSTOM' ? '' : ']]' }}
          </UBadge>
        </div>

        <div class="prose prose-sm mt-6 max-w-none">
          <MDC :value="entry?.contentMarkdown || '_No content._'" tag="article" />
        </div>
      </UCard>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      title="Edit journal entry"
      description="Update markdown, visibility, and linked sessions."
      :saving="isSaving"
      :error="actionError"
      submit-label="Save changes"
      @submit="saveEdit"
    >
      <UFormField label="Title" name="title" required>
        <UInput v-model="form.title" />
      </UFormField>
      <UFormField label="Visibility" name="visibility" required>
        <USelect
          v-model="form.visibility"
          :items="[
            { label: 'Myself', value: 'MYSELF' },
            { label: 'DM', value: 'DM' },
            { label: 'Campaign', value: 'CAMPAIGN' },
          ]"
        />
      </UFormField>
      <UFormField label="Linked sessions" name="sessionIds">
        <USelectMenu
          v-model="formSessionIds"
          multiple
          clear
          value-key="id"
          label-key="label"
          :items="sessionItems"
          placeholder="Select sessions"
        />
      </UFormField>
      <UFormField label="Entry markdown" name="contentMarkdown" required>
        <UTabs
          v-model="editorTab"
          :items="[
            { label: 'Write', value: 'write' },
            { label: 'Preview', value: 'preview' },
          ]"
          :content="false"
        />
        <div class="mt-3 rounded-md border border-default p-3">
          <UTextarea
            v-if="editorTab === 'write'"
            v-model="form.contentMarkdown"
            :rows="12"
            placeholder="Use markdown with #tags and [[Glossary Name]] mentions."
          />
          <div v-else class="prose prose-sm max-w-none">
            <MDC :value="form.contentMarkdown || '_No content yet._'" tag="article" />
          </div>
        </div>
      </UFormField>

      <UAlert
        v-if="unresolvedGlossaryMentions.length"
        color="warning"
        variant="subtle"
        title="Unresolved glossary mentions"
        :description="`No glossary entry matched: ${unresolvedGlossaryMentions.join(', ')}`"
      />
    </SharedEntityFormModal>
  </div>
</template>
