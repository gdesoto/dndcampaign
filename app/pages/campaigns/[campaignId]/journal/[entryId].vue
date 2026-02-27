<script setup lang="ts">
import type {
  CampaignJournalUpdateInput,
  CampaignJournalVisibilityInput,
} from '#shared/schemas/campaign-journal'
import { extractJournalTagCandidatesFromMarkdown } from '#shared/utils/campaign-journal-tags'
import type { CampaignAccess } from '#shared/types/campaign-workflow'
import CampaignDetailTemplate from '~/components/campaign/templates/CampaignDetailTemplate.vue'
import CampaignEditorTemplate from '~/components/campaign/templates/CampaignEditorTemplate.vue'

definePageMeta({ layout: 'dashboard' })

type SessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
}

type GlossaryLite = {
  id: string
  name: string
}

const UNASSIGNED_HOLDER_VALUE = '__UNASSIGNED__'

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const entryId = computed(() => route.params.entryId as string)
const journalApi = useCampaignJournal()
const { request } = useApi()
const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id?: string } | null)?.id || '')
const campaignAccess = inject<ComputedRef<CampaignAccess | undefined>>(
  'campaignAccess',
  computed(() => undefined),
)

const canManageDiscoverables = computed(() => Boolean(campaignAccess.value?.hasDmAccess))

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

const { data: membersResponse } = await useAsyncData(
  () => `journal-detail-member-options-${campaignId.value}`,
  async () => {
    try {
      return await journalApi.listMemberOptions(campaignId.value)
    } catch {
      return { items: [] }
    }
  },
)

const {
  data: history,
  refresh: refreshHistory,
} = await useAsyncData(
  () => `journal-history-${campaignId.value}-${entryId.value}`,
  () => journalApi.listEntryHistory(campaignId.value, entryId.value, { page: 1, pageSize: 30 }),
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

const memberItems = computed(() =>
  (membersResponse.value?.items || []).map((member: { userId: string; name: string; hasDmAccess: boolean }) => ({
    value: member.userId,
    label: `${member.name}${member.hasDmAccess ? ' (DM)' : ''}`,
  })),
)

const visibilityItems = computed(() =>
  entry.value?.isDiscoverable
    ? [
        { label: 'DM', value: 'DM' },
        { label: 'Campaign', value: 'CAMPAIGN' },
      ]
    : [
        { label: 'DM', value: 'DM' },
        { label: 'Campaign', value: 'CAMPAIGN' },
        { label: 'Myself', value: 'MYSELF' },
      ],
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
    const holderOnlyEdit = entry.value.isDiscoverable && !canManageDiscoverables.value
    await journalApi.updateEntry(campaignId.value, entryId.value, holderOnlyEdit
      ? {
          visibility: form.visibility === 'CAMPAIGN' ? 'CAMPAIGN' : 'DM',
        }
      : {
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

const isHolder = computed(() => Boolean(entry.value?.holderUserId && entry.value.holderUserId === currentUserId.value))
const canTransfer = computed(() => Boolean(entry.value?.isDiscoverable && (isHolder.value || canManageDiscoverables.value)))
const canArchive = computed(() => Boolean(entry.value?.isDiscoverable && (isHolder.value || canManageDiscoverables.value)))
const canDiscover = computed(() => Boolean(entry.value?.isDiscoverable && canManageDiscoverables.value))

const holderUserId = ref(UNASSIGNED_HOLDER_VALUE)
const transferVisibility = ref<'DM' | 'CAMPAIGN'>('DM')
const actionLoading = ref(false)

watch(entry, (value) => {
  holderUserId.value = value?.holderUserId || UNASSIGNED_HOLDER_VALUE
  transferVisibility.value = value?.visibility === 'CAMPAIGN' ? 'CAMPAIGN' : 'DM'
}, { immediate: true })

const refreshEntryData = async () => {
  await Promise.all([refresh(), refreshHistory()])
}

const discoverToHolder = async () => {
  if (!canDiscover.value || holderUserId.value === UNASSIGNED_HOLDER_VALUE) return
  actionLoading.value = true
  try {
    await journalApi.discoverEntry(campaignId.value, entryId.value, {
      holderUserId: holderUserId.value,
      visibility: transferVisibility.value,
    })
    await refreshEntryData()
    toast.add({ title: 'Entry discovered', color: 'success', icon: 'i-lucide-check' })
  } catch (cause) {
    toast.add({ title: 'Discover failed', description: (cause as Error).message, color: 'error' })
  } finally {
    actionLoading.value = false
  }
}

const transferHolder = async () => {
  if (!canTransfer.value) return
  actionLoading.value = true
  try {
    await journalApi.transferEntry(campaignId.value, entryId.value, {
      toHolderUserId: holderUserId.value === UNASSIGNED_HOLDER_VALUE ? null : holderUserId.value,
      visibility: transferVisibility.value,
    })
    await refreshEntryData()
    toast.add({ title: 'Entry transferred', color: 'success', icon: 'i-lucide-check' })
  } catch (cause) {
    toast.add({ title: 'Transfer failed', description: (cause as Error).message, color: 'error' })
  } finally {
    actionLoading.value = false
  }
}

const toggleArchive = async () => {
  if (!canArchive.value || !entry.value) return
  actionLoading.value = true
  try {
    if (entry.value.isArchived) {
      await journalApi.unarchiveEntry(campaignId.value, entryId.value)
    } else {
      await journalApi.archiveEntry(campaignId.value, entryId.value, { archived: true })
    }
    await refreshEntryData()
    toast.add({ title: entry.value.isArchived ? 'Entry unarchived' : 'Entry archived', color: 'success', icon: 'i-lucide-check' })
  } catch (cause) {
    toast.add({ title: 'Archive update failed', description: (cause as Error).message, color: 'error' })
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
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

      <CampaignDetailTemplate
        :back-to="`/campaigns/${campaignId}/journal`"
        back-label="Back to journal"
        headline="Journal"
        :title="entry?.title || 'Journal entry'"
        :description="entry ? `By ${entry.authorName}` : ''"
      >
        <template #actions>
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

        <UCard class="lg:min-h-[28rem]">
          <template #header>
            <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-dimmed">Entry</h3>
          </template>
          <div class="prose prose-sm max-w-none">
            <MDC :value="entry?.contentMarkdown || '_No content._'" tag="article" />
          </div>
        </UCard>

        <template #aside>
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold">Details</h3>
            </template>
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="visibilityColor(entry!.visibility)" variant="soft">
                {{ visibilityLabelMap[entry!.visibility] }}
              </UBadge>
              <UBadge v-if="entry?.isDiscoverable" color="info" variant="soft">Discoverable</UBadge>
              <UBadge v-if="entry?.holderUserName" color="neutral" variant="soft">Holder: {{ entry.holderUserName }}</UBadge>
              <UBadge v-if="entry?.isArchived" color="warning" variant="soft">Archived</UBadge>
            </div>
            <p class="mt-3 text-xs text-muted">Updated {{ new Date(entry!.updatedAt).toLocaleString() }}</p>

            <div v-if="entry?.sessions.length" class="mt-4 space-y-2">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Linked sessions</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="session in entry.sessions"
                  :key="session.sessionId"
                  color="neutral"
                  variant="outline"
                >
                  {{ session.sessionNumber ? `S${session.sessionNumber}` : 'Session' }}: {{ session.title }}
                </UBadge>
              </div>
            </div>

            <div v-if="entry?.tags.length" class="mt-4 space-y-2">
              <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Tags</p>
              <div class="flex flex-wrap gap-2">
                <UBadge
                  v-for="tag in entry.tags"
                  :key="tag.id"
                  variant="outline"
                  color="primary"
                >
                  {{ tag.tagType === 'CUSTOM' ? '#' : '[[' }}{{ tag.displayLabel }}{{ tag.tagType === 'CUSTOM' ? '' : ']]' }}
                </UBadge>
              </div>
            </div>
          </UCard>

          <UCard v-if="entry?.isDiscoverable">
            <template #header>
              <h3 class="text-sm font-semibold">Discoverable Actions</h3>
            </template>
            <div class="space-y-3">
              <USelect
                v-model="holderUserId"
                class="w-full"
                :items="[{ label: 'Unassigned', value: UNASSIGNED_HOLDER_VALUE }, ...memberItems]"
                placeholder="Select holder"
                :disabled="!canTransfer && !canDiscover"
              />
              <USelect
                v-model="transferVisibility"
                class="w-full"
                :items="[
                  { label: 'DM', value: 'DM' },
                  { label: 'Campaign', value: 'CAMPAIGN' },
                ]"
                :disabled="!canTransfer && !canDiscover"
              />
              <div class="flex flex-wrap gap-2">
                <UButton size="xs" :disabled="!canDiscover || holderUserId === UNASSIGNED_HOLDER_VALUE" :loading="actionLoading" @click="discoverToHolder">
                  Discover
                </UButton>
                <UButton size="xs" variant="outline" :disabled="!canTransfer" :loading="actionLoading" @click="transferHolder">
                  Transfer
                </UButton>
                <UButton size="xs" color="warning" variant="outline" :disabled="!canArchive" :loading="actionLoading" @click="toggleArchive">
                  {{ entry?.isArchived ? 'Unarchive' : 'Archive' }}
                </UButton>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold">History</h3>
            </template>
            <div v-if="!(history?.items.length)" class="text-sm text-muted">No discovery or transfer events yet.</div>
            <div v-else class="max-h-72 space-y-2 overflow-y-auto pr-1">
              <div v-for="event in history.items" :key="event.id" class="rounded border border-default p-2">
                <div class="flex items-center justify-between gap-2">
                  <UBadge size="xs" variant="soft">{{ event.action }}</UBadge>
                  <p class="text-xs text-muted">{{ new Date(event.createdAt).toLocaleString() }}</p>
                </div>
                <p class="text-sm text-default">{{ event.actorUserName }}: {{ event.fromHolderUserName || 'Unassigned' }} → {{ event.toHolderUserName || 'Unassigned' }}</p>
              </div>
            </div>
          </UCard>
        </template>
      </CampaignDetailTemplate>
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
        <UInput v-model="form.title" :disabled="Boolean(entry?.isDiscoverable && !canManageDiscoverables)" />
      </UFormField>
      <UFormField label="Visibility" name="visibility" required>
        <USelect
          v-model="form.visibility"
          class="w-full"
          :items="visibilityItems"
        />
      </UFormField>
      <UFormField label="Linked sessions" name="sessionIds">
        <UInputMenu
          v-model="formSessionIds"
          class="w-full min-w-0"
          multiple
          value-key="id"
          label-key="label"
          :items="sessionItems"
          placeholder="Select sessions"
          :disabled="Boolean(entry?.isDiscoverable && !canManageDiscoverables)"
        />
      </UFormField>
      <UFormField label="Entry markdown" name="contentMarkdown" required>
        <CampaignEditorTemplate
          :model-value="form.contentMarkdown || ''"
          :tab="editorTab"
          :disabled="Boolean(entry?.isDiscoverable && !canManageDiscoverables)"
          placeholder="Use markdown with #tags and [[Glossary Name]] mentions."
          @update:model-value="form.contentMarkdown = $event"
          @update:tab="editorTab = $event"
        />
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

