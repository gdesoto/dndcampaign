<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
definePageMeta({ layout: 'dashboard' })

type QuestItem = {
  id: string
  title: string
  description?: string | null
  type: 'MAIN' | 'SIDE' | 'PLAYER'
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes?: string | null
}

const { campaignId, request, canWriteContent } = useCampaignPageContext()

const { data: quests, pending, refresh, error } = await useAsyncData(
  () => `quests-${campaignId.value}`,
  () => request<QuestItem[]>(`/api/campaigns/${campaignId.value}/quests`)
)

const isInitialQuestsLoadPending = computed(() => pending.value && !quests.value)

const statusOptions: Array<{ label: string; value: QuestItem['status'] }> = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'On hold', value: 'ON_HOLD' },
]

const typeOptions: Array<{ label: string; value: QuestItem['type'] }> = [
  { label: 'Main quest', value: 'MAIN' },
  { label: 'Side quest', value: 'SIDE' },
  { label: 'Player quest', value: 'PLAYER' },
]

const statusFilterOptions = [
  { label: 'All statuses', value: 'ALL' },
  ...statusOptions,
]

const typeFilterOptions = [
  { label: 'All quest types', value: 'ALL' },
  ...typeOptions,
]

const selectedStatusFilter = ref<'ALL' | QuestItem['status']>('ALL')
const selectedTypeFilter = ref<'ALL' | QuestItem['type']>('ALL')

const statusLabelMap: Record<QuestItem['status'], string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ON_HOLD: 'On hold',
}

const typeLabelMap: Record<QuestItem['type'], string> = {
  MAIN: 'Main quest',
  SIDE: 'Side quest',
  PLAYER: 'Player quest',
}

const typeBadgeColor = (type: QuestItem['type']) => {
  if (type === 'MAIN') return 'primary'
  if (type === 'PLAYER') return 'warning'
  return 'neutral'
}

const filteredQuests = computed(() => {
  const source = quests.value || []
  return source.filter((quest) => {
    const typeMatch = selectedTypeFilter.value === 'ALL' || quest.type === selectedTypeFilter.value
    const statusMatch =
      selectedStatusFilter.value === 'ALL' || quest.status === selectedStatusFilter.value
    return typeMatch && statusMatch
  })
})

const primaryQuests = computed(() =>
  filteredQuests.value.filter((quest) => quest.status === 'ACTIVE' || quest.status === 'ON_HOLD')
)

const closedQuests = computed(() =>
  filteredQuests.value.filter((quest) => quest.status === 'COMPLETED' || quest.status === 'FAILED')
)

const {
  isOpen: isEditOpen,
  mode: editMode,
  form: editForm,
  error: editError,
  isSaving,
  openCreate: openQuestCreate,
  openEdit: openQuestEdit,
  saveWith: saveQuestWith,
} = useCrudModal(() => ({
  id: '',
  title: '',
  description: '',
  type: 'SIDE' as QuestItem['type'],
  status: 'ACTIVE' as QuestItem['status'],
  progressNotes: '',
}))

const deletingQuestId = ref<string | null>(null)

const openCreate = () => {
  if (!canWriteContent.value) return
  openQuestCreate()
}

const openEdit = (quest: QuestItem) => {
  if (!canWriteContent.value) return
  openQuestEdit({
    id: quest.id,
    title: quest.title,
    description: quest.description || '',
    type: quest.type,
    status: quest.status,
    progressNotes: quest.progressNotes || '',
  })
}

const saveQuest = async () => {
  if (!canWriteContent.value) return
  await saveQuestWith(async ({ mode, form }) => {
    if (mode === 'create') {
      await request(`/api/campaigns/${campaignId.value}/quests`, {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description || undefined,
          type: form.type,
          status: form.status,
          progressNotes: form.progressNotes || undefined,
        },
      })
    } else {
      await request(`/api/quests/${form.id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          description: form.description || null,
          type: form.type,
          status: form.status,
          progressNotes: form.progressNotes || null,
        },
      })
    }
    await refresh()
  }, 'Unable to save quest.')
}

const deleteQuest = async (quest: QuestItem) => {
  if (!canWriteContent.value) return
  deletingQuestId.value = quest.id
  try {
    await request(`/api/quests/${quest.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingQuestId.value = null
  }
}

const deleteEditingQuest = async () => {
  if (editMode.value !== 'edit') return
  const quest = (quests.value || []).find((item) => item.id === editForm.id)
  if (!quest) return

  await deleteQuest(quest)
  isEditOpen.value = false
}

const updateStatus = async (quest: QuestItem, status: QuestItem['status']) => {
  if (!canWriteContent.value) return
  await request(`/api/quests/${quest.id}`, {
    method: 'PATCH',
    body: { status },
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <CampaignListTemplate
      headline="Quests"
      title="Quest tracker"
      description="Track active, on-hold, completed, and failed quest progress."
      action-label="New quest"
      action-icon="i-lucide-plus"
      :action-disabled="!canWriteContent"
      @action="openCreate"
    >
      <template #notice>
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can view quests but cannot change them."
        />
      </template>

      <template #filters>
        <UCard>
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="Filter by type" name="typeFilter">
              <USelect v-model="selectedTypeFilter" :items="typeFilterOptions" />
            </UFormField>
            <UFormField label="Filter by status" name="statusFilter">
              <USelect v-model="selectedStatusFilter" :items="statusFilterOptions" />
            </UFormField>
          </div>
        </UCard>
      </template>

      <SharedResourceState
        :pending="isInitialQuestsLoadPending"
        :error="error"
        :empty="!quests?.length"
        error-message="Unable to load quests."
        empty-message="No quests yet."
        @retry="refresh"
      >
        <template #loading>
          <div class="grid gap-4 sm:grid-cols-2">
            <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse" />
          </div>
        </template>
        <template #emptyActions>
          <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first quest</UButton>
        </template>

        <div v-if="quests?.length" class="space-y-6">
          <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">Active and on hold quests</h2>
            <span class="text-xs text-muted">{{ primaryQuests.length }} shown</span>
          </div>
          <div v-if="primaryQuests.length" class="grid gap-4 sm:grid-cols-2">
            <CampaignQuestCard
              v-for="quest in primaryQuests"
              :key="quest.id"
              :quest="quest"
              :can-write-content="canWriteContent"
              :status-options="statusOptions"
              :status-label-map="statusLabelMap"
              :type-label-map="typeLabelMap"
              :type-badge-color="typeBadgeColor"
              @edit="openEdit"
              @update-status="(quest, status) => updateStatus(quest, status as QuestItem['status'])"
            />
          </div>
          <UCard v-else>
            <p class="text-sm text-muted">No active or on-hold quests match the current filters.</p>
          </UCard>
          </section>

          <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">Completed and failed quests</h2>
            <span class="text-xs text-muted">{{ closedQuests.length }} shown</span>
          </div>
          <div v-if="closedQuests.length" class="grid gap-4 sm:grid-cols-2">
            <CampaignQuestCard
              v-for="quest in closedQuests"
              :key="quest.id"
              :quest="quest"
              :can-write-content="canWriteContent"
              :status-options="statusOptions"
              :status-label-map="statusLabelMap"
              :type-label-map="typeLabelMap"
              :type-badge-color="typeBadgeColor"
              @edit="openEdit"
              @update-status="(quest, status) => updateStatus(quest, status as QuestItem['status'])"
            />
          </div>
          <UCard v-else>
            <p class="text-sm text-muted">No completed or failed quests match the current filters.</p>
          </UCard>
          </section>
        </div>
      </SharedResourceState>
    </CampaignListTemplate>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      :title="editMode === 'create' ? 'Create quest' : 'Edit quest'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      :show-delete-action="editMode === 'edit'"
      :delete-loading="deletingQuestId === editForm.id"
      @delete="deleteEditingQuest"
      @submit="saveQuest"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="editForm.title" />
      </UFormField>
      <UFormField label="Quest type" name="type">
        <USelect v-model="editForm.type" :items="typeOptions" />
      </UFormField>
      <UFormField label="Status" name="status">
        <USelect v-model="editForm.status" :items="statusOptions" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="editForm.description" :rows="4" />
      </UFormField>
      <UFormField label="Progress notes" name="progressNotes">
        <UTextarea v-model="editForm.progressNotes" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>


