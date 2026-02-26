<script setup lang="ts">
import type {
  CampaignJournalCreateInput,
  CampaignJournalListQueryInput,
  CampaignJournalUpdateInput,
  CampaignJournalVisibilityInput,
} from '#shared/schemas/campaign-journal'
import type {
  CampaignJournalEntryListItem,
  CampaignJournalTagListItem,
} from '#shared/types/campaign-journal'
import { extractJournalTagCandidatesFromMarkdown } from '#shared/utils/campaign-journal-tags'
import type { CampaignAccess } from '#shared/types/campaign-workflow'

definePageMeta({ layout: 'default' })

type JournalTab = 'mine' | 'campaign' | 'dm'
type EditorTab = 'write' | 'preview'

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
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const campaignAccess = inject<ComputedRef<CampaignAccess | undefined>>(
  'campaignAccess',
  computed(() => undefined),
)
const journalApi = useCampaignJournal()
const { request } = useApi()
const toast = useToast()

const selectedTab = ref<JournalTab>('mine')
const selectedSessionId = ref('')
const selectedTag = ref('')
const search = ref('')
const listError = ref('')
const actionError = ref('')

const tabItems = [
  { label: 'Mine', value: 'mine' },
  { label: 'Campaign', value: 'campaign' },
  { label: 'DM-visible', value: 'dm' },
]

const canSeeDmTab = computed(() => Boolean(campaignAccess.value?.hasDmAccess))
const visibleTabItems = computed(() =>
  tabItems.filter((tab) => tab.value !== 'dm' || canSeeDmTab.value),
)

watch(
  canSeeDmTab,
  (value) => {
    if (!value && selectedTab.value === 'dm') {
      selectedTab.value = 'mine'
    }
  },
  { immediate: true },
)

const listQuery = computed<CampaignJournalListQueryInput>(() => ({
  page: 1,
  pageSize: 50,
  ...(selectedTab.value === 'mine' ? { mine: true } : {}),
  ...(selectedTab.value === 'campaign' ? { visibility: 'CAMPAIGN' } : {}),
  ...(selectedTab.value === 'dm' ? { dmVisible: true } : {}),
  ...(selectedSessionId.value ? { sessionId: selectedSessionId.value } : {}),
  ...(selectedTag.value ? { tag: selectedTag.value } : {}),
  ...(search.value.trim() ? { search: search.value.trim() } : {}),
}))

const {
  data: sessions,
  pending: sessionsPending,
  error: sessionsError,
} = await useAsyncData(
  () => `journal-sessions-${campaignId.value}`,
  () => request<SessionOption[]>(`/api/campaigns/${campaignId.value}/sessions`),
)

const {
  data: glossaryEntries,
} = await useAsyncData(
  () => `journal-glossary-${campaignId.value}`,
  () => request<GlossaryLite[]>(`/api/campaigns/${campaignId.value}/glossary`),
)

const {
  data: tagsResponse,
  pending: tagsPending,
  error: tagsError,
  refresh: refreshTags,
} = await useAsyncData(
  () => `journal-tags-${campaignId.value}`,
  () => journalApi.listTags(campaignId.value, { page: 1, pageSize: 200 }),
)

const {
  data: listResponse,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () =>
    `journal-list-${campaignId.value}-${selectedTab.value}-${selectedSessionId.value}-${selectedTag.value}-${search.value}`,
  async () => {
    listError.value = ''
    try {
      return await journalApi.listEntries(campaignId.value, listQuery.value)
    } catch (cause) {
      listError.value = (cause as Error).message || 'Unable to load journal entries.'
      throw cause
    }
  },
  { watch: [selectedTab, selectedSessionId, selectedTag, search] },
)

const entries = computed(() => listResponse.value?.items || [])
const isEmpty = computed(() => entries.value.length === 0)
const hasLoadedAtLeastOnce = computed(() => Array.isArray(listResponse.value?.items))
const showLoadingState = computed(() => pending.value && !hasLoadedAtLeastOnce.value)

const sessionItems = computed(() =>
  (sessions.value || []).map((session) => ({
    id: session.id,
    label: session.sessionNumber
      ? `Session ${session.sessionNumber}: ${session.title}`
      : session.title,
  })),
)

const tagItems = computed(() =>
  ((tagsResponse.value?.items || []) as CampaignJournalTagListItem[]).map((tag) => ({
    value: tag.normalizedLabel,
    label: `${tag.displayLabel} (${tag.usageCount})`,
  })),
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

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isSaving = ref(false)
const editTargetId = ref('')
const editorTab = ref<EditorTab>('write')

const form = reactive<CampaignJournalCreateInput>({
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

const resetForm = () => {
  form.title = ''
  form.contentMarkdown = ''
  form.visibility = 'MYSELF'
  form.sessionIds = []
  editorTab.value = 'write'
}

const openCreate = () => {
  if (!canWriteContent.value) return
  actionError.value = ''
  editTargetId.value = ''
  resetForm()
  isCreateOpen.value = true
}

const openEdit = (entry: CampaignJournalEntryListItem) => {
  actionError.value = ''
  editTargetId.value = entry.id
  form.title = entry.title
  form.contentMarkdown = entry.contentMarkdown
  form.visibility = entry.visibility
  form.sessionIds = entry.sessions.map((session) => session.sessionId)
  editorTab.value = 'write'
  isEditOpen.value = true
}

const glossaryNameSet = computed(() =>
  new Set((glossaryEntries.value || []).map((entry) => entry.name.trim().toLowerCase())),
)

const extractedCandidates = computed(() =>
  extractJournalTagCandidatesFromMarkdown(form.contentMarkdown || ''),
)

const unresolvedGlossaryMentions = computed(() =>
  extractedCandidates.value.glossaryMentions.filter(
    (mention) => !glossaryNameSet.value.has(mention.trim().toLowerCase()),
  ),
)

const saveCreate = async () => {
  if (!canWriteContent.value) return
  isSaving.value = true
  actionError.value = ''
  try {
    const payload: CampaignJournalCreateInput = {
      title: form.title,
      contentMarkdown: form.contentMarkdown,
      visibility: form.visibility,
      sessionIds: form.sessionIds || [],
    }
    await journalApi.createEntry(campaignId.value, payload)
    isCreateOpen.value = false
    resetForm()
    await Promise.all([refresh(), refreshTags()])
    toast.add({
      title: 'Entry created',
      description: 'Journal entry saved successfully.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to create journal entry.'
    toast.add({
      title: 'Unable to create entry',
      description: actionError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSaving.value = false
  }
}

const saveEdit = async () => {
  if (!editTargetId.value) return
  isSaving.value = true
  actionError.value = ''
  try {
    const payload: CampaignJournalUpdateInput = {
      title: form.title,
      contentMarkdown: form.contentMarkdown,
      visibility: form.visibility,
      sessionIds: form.sessionIds || [],
    }
    await journalApi.updateEntry(campaignId.value, editTargetId.value, payload)
    isEditOpen.value = false
    await Promise.all([refresh(), refreshTags()])
    toast.add({
      title: 'Entry updated',
      description: 'Journal entry updated successfully.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch (cause) {
    actionError.value = (cause as Error).message || 'Unable to update journal entry.'
    toast.add({
      title: 'Unable to update entry',
      description: actionError.value,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    isSaving.value = false
  }
}

const actionLoadingByEntryId = reactive<Record<string, boolean>>({})

const deleteEntry = async (entry: CampaignJournalEntryListItem) => {
  actionLoadingByEntryId[entry.id] = true
  try {
    await journalApi.deleteEntry(campaignId.value, entry.id)
    await Promise.all([refresh(), refreshTags()])
    toast.add({
      title: 'Entry deleted',
      description: 'Journal entry removed.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch (cause) {
    const message = (cause as Error).message || 'Unable to delete journal entry.'
    toast.add({
      title: 'Delete failed',
      description: message,
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  } finally {
    actionLoadingByEntryId[entry.id] = false
  }
}

const truncatedMarkdown = (content: string) => {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Journal</p>
        <h1 class="mt-2 text-2xl font-semibold">Campaign journal</h1>
      </div>
      <UButton size="lg" icon="i-lucide-plus" :disabled="!canWriteContent" @click="openCreate">
        New entry
      </UButton>
    </div>

    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only role"
      description="Your role can view entries but cannot create new entries."
    />

    <UCard>
      <UTabs v-model="selectedTab" :items="visibleTabItems" :content="false" />
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <USelect
          v-model="selectedSessionId"
          :items="[{ label: 'All sessions', value: '' }, ...sessionItems]"
          :loading="sessionsPending"
          :disabled="Boolean(sessionsError)"
          placeholder="Filter by session"
        />
        <USelect
          v-model="selectedTag"
          :items="[{ label: 'All tags', value: '' }, ...tagItems]"
          :loading="tagsPending"
          :disabled="Boolean(tagsError)"
          placeholder="Filter by tag"
        />
        <UInput
          v-model="search"
          class="md:col-span-2"
          icon="i-lucide-search"
          placeholder="Search title, markdown, or tag text"
        />
      </div>
    </UCard>

    <SharedResourceState
      :pending="showLoadingState"
      :error="error || listError"
      :empty="isEmpty"
      error-message="Unable to load journal entries."
      empty-message="No entries in this view."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard v-for="i in 4" :key="i" class="h-40 animate-pulse" />
        </div>
      </template>
      <template #emptyActions>
        <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">
          Create first entry
        </UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <SharedListItemCard
          v-for="entry in entries"
          :key="entry.id"
        >
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Journal entry</p>
                <NuxtLink
                  class="text-base font-semibold text-primary hover:underline"
                  :to="`/campaigns/${campaignId}/journal/${entry.id}`"
                >
                  {{ entry.title }}
                </NuxtLink>
                <p class="text-xs text-muted">By {{ entry.authorName }}</p>
              </div>
              <UBadge :color="visibilityColor(entry.visibility)" variant="soft" size="sm">
                {{ visibilityLabelMap[entry.visibility] }}
              </UBadge>
            </div>
          </template>

          <p class="text-sm text-default">{{ truncatedMarkdown(entry.contentMarkdown) }}</p>

          <div v-if="entry.sessions.length" class="mt-3 flex flex-wrap gap-2">
            <UBadge
              v-for="session in entry.sessions"
              :key="session.sessionId"
              color="neutral"
              variant="soft"
              size="sm"
            >
              {{ session.sessionNumber ? `S${session.sessionNumber}` : 'Session' }}: {{ session.title }}
            </UBadge>
          </div>

          <div v-if="entry.tags.length" class="mt-3 flex flex-wrap gap-2">
            <UBadge
              v-for="tag in entry.tags"
              :key="tag.id"
              variant="outline"
              size="sm"
            >
              {{ tag.tagType === 'CUSTOM' ? '#' : '[[' }}{{ tag.displayLabel }}{{ tag.tagType === 'CUSTOM' ? '' : ']]' }}
            </UBadge>
          </div>

          <div class="mt-3 text-xs text-muted">
            Updated {{ new Date(entry.updatedAt).toLocaleString() }}
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              size="xs"
              variant="outline"
              :to="`/campaigns/${campaignId}/journal/${entry.id}`"
            >
              Open
            </UButton>
            <UButton
              v-if="entry.canEdit"
              size="xs"
              variant="outline"
              @click="openEdit(entry)"
            >
              Edit
            </UButton>
            <SharedConfirmActionPopover
              v-if="entry.canDelete"
              trigger-label="Delete"
              trigger-color="error"
              trigger-variant="ghost"
              trigger-size="xs"
              trigger-icon="i-lucide-trash-2"
              trigger-aria-label="Delete journal entry"
              confirm-label="Delete"
              confirm-color="error"
              :confirm-loading="Boolean(actionLoadingByEntryId[entry.id])"
              :message="`Delete '${entry.title}'? This action cannot be undone.`"
              @confirm="({ close }) => { deleteEntry(entry); close() }"
            />
          </div>
        </SharedListItemCard>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isCreateOpen"
      title="Create journal entry"
      description="Write markdown notes and control entry visibility."
      :saving="isSaving"
      :error="actionError"
      submit-label="Create entry"
      @submit="saveCreate"
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
        <p class="mt-2 text-xs text-muted">
          Tag syntax: `#custom-tag` and `[[Glossary Name]]`
        </p>
      </UFormField>

      <UAlert
        v-if="unresolvedGlossaryMentions.length"
        color="warning"
        variant="subtle"
        title="Unresolved glossary mentions"
        :description="`No glossary entry matched: ${unresolvedGlossaryMentions.join(', ')}`"
      />

      <div
        v-if="extractedCandidates.customTags.length || extractedCandidates.glossaryMentions.length"
        class="space-y-2"
      >
        <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Extracted tags</p>
        <div class="flex flex-wrap gap-2">
          <UBadge v-for="tag in extractedCandidates.customTags" :key="`custom-${tag}`" color="neutral" variant="soft">
            #{{ tag }}
          </UBadge>
          <UBadge
            v-for="mention in extractedCandidates.glossaryMentions"
            :key="`mention-${mention}`"
            color="primary"
            variant="soft"
          >
            [[{{ mention }}]]
          </UBadge>
        </div>
      </div>
    </SharedEntityFormModal>

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
    </SharedEntityFormModal>
  </div>
</template>
