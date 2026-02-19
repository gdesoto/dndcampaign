<script setup lang="ts">
definePageMeta({ layout: 'default' })

type QuestItem = {
  id: string
  title: string
  description?: string | null
  type: 'MAIN' | 'SIDE' | 'PLAYER'
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes?: string | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const { data: quests, pending, refresh, error } = await useAsyncData(
  () => `quests-${campaignId.value}`,
  () => request<QuestItem[]>(`/api/campaigns/${campaignId.value}/quests`)
)

const statusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'On hold', value: 'ON_HOLD' },
]

const typeOptions = [
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

const isEditOpen = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: '',
  title: '',
  description: '',
  type: 'SIDE' as QuestItem['type'],
  status: 'ACTIVE',
  progressNotes: '',
})
const editError = ref('')
const isSaving = ref(false)

const openCreate = () => {
  if (!canWriteContent.value) return
  editMode.value = 'create'
  editError.value = ''
  editForm.id = ''
  editForm.title = ''
  editForm.description = ''
  editForm.type = 'SIDE'
  editForm.status = 'ACTIVE'
  editForm.progressNotes = ''
  isEditOpen.value = true
}

const openEdit = (quest: QuestItem) => {
  if (!canWriteContent.value) return
  editMode.value = 'edit'
  editError.value = ''
  editForm.id = quest.id
  editForm.title = quest.title
  editForm.description = quest.description || ''
  editForm.type = quest.type
  editForm.status = quest.status
  editForm.progressNotes = quest.progressNotes || ''
  isEditOpen.value = true
}

const saveQuest = async () => {
  if (!canWriteContent.value) return
  editError.value = ''
  isSaving.value = true
  try {
    if (editMode.value === 'create') {
      await request(`/api/campaigns/${campaignId.value}/quests`, {
        method: 'POST',
        body: {
          title: editForm.title,
          description: editForm.description || undefined,
          type: editForm.type,
          status: editForm.status,
          progressNotes: editForm.progressNotes || undefined,
        },
      })
    } else {
      await request(`/api/quests/${editForm.id}`, {
        method: 'PATCH',
        body: {
          title: editForm.title,
          description: editForm.description || null,
          type: editForm.type,
          status: editForm.status,
          progressNotes: editForm.progressNotes || null,
        },
      })
    }
    isEditOpen.value = false
    await refresh()
  } catch (error) {
    editError.value =
      (error as Error & { message?: string }).message || 'Unable to save quest.'
  } finally {
    isSaving.value = false
  }
}

const deleteQuest = async (quest: QuestItem) => {
  if (!canWriteContent.value) return
  await request(`/api/quests/${quest.id}`, { method: 'DELETE' })
  await refresh()
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
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Quests</p>
        <h1 class="mt-2 text-2xl font-semibold">Quest tracker</h1>
      </div>
      <UButton size="lg" :disabled="!canWriteContent" @click="openCreate">New quest</UButton>
    </div>
    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="Your role can view quests but cannot change them."
    />

    <SharedResourceState
      :pending="pending"
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
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField label="Filter by type" name="typeFilter">
            <USelect v-model="selectedTypeFilter" :items="typeFilterOptions" />
          </UFormField>
          <UFormField label="Filter by status" name="statusFilter">
            <USelect v-model="selectedStatusFilter" :items="statusFilterOptions" />
          </UFormField>
        </div>

        <section class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">Active and on hold quests</h2>
            <span class="text-xs text-muted">{{ primaryQuests.length }} shown</span>
          </div>
          <div v-if="primaryQuests.length" class="grid gap-4 sm:grid-cols-2">
            <SharedListItemCard v-for="quest in primaryQuests" :key="quest.id">
              <template #header>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quest</p>
                    <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
                  </div>
                  <div class="flex gap-2">
                    <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="openEdit(quest)">Edit</UButton>
                    <UButton size="xs" color="error" variant="ghost" :disabled="!canWriteContent" @click="deleteQuest(quest)">Delete</UButton>
                  </div>
                </div>
              </template>
              <p class="text-sm text-default">{{ quest.description || 'Add quest notes.' }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UBadge :color="typeBadgeColor(quest.type)" variant="soft" size="sm">
                  {{ typeLabelMap[quest.type] }}
                </UBadge>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ statusLabelMap[quest.status] }}
                </UBadge>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <USelect
                  :disabled="!canWriteContent"
                  :items="statusOptions"
                  :model-value="quest.status"
                  @update:model-value="(value) => updateStatus(quest, value as QuestItem['status'])"
                />
                <span class="text-xs text-muted">{{ quest.progressNotes || 'No progress notes.' }}</span>
              </div>
            </SharedListItemCard>
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
            <SharedListItemCard v-for="quest in closedQuests" :key="quest.id">
              <template #header>
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quest</p>
                    <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
                  </div>
                  <div class="flex gap-2">
                    <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="openEdit(quest)">Edit</UButton>
                    <UButton size="xs" color="error" variant="ghost" :disabled="!canWriteContent" @click="deleteQuest(quest)">Delete</UButton>
                  </div>
                </div>
              </template>
              <p class="text-sm text-default">{{ quest.description || 'Add quest notes.' }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                <UBadge :color="typeBadgeColor(quest.type)" variant="soft" size="sm">
                  {{ typeLabelMap[quest.type] }}
                </UBadge>
                <UBadge color="neutral" variant="soft" size="sm">
                  {{ statusLabelMap[quest.status] }}
                </UBadge>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <USelect
                  :disabled="!canWriteContent"
                  :items="statusOptions"
                  :model-value="quest.status"
                  @update:model-value="(value) => updateStatus(quest, value as QuestItem['status'])"
                />
                <span class="text-xs text-muted">{{ quest.progressNotes || 'No progress notes.' }}</span>
              </div>
            </SharedListItemCard>
          </div>
          <UCard v-else>
            <p class="text-sm text-muted">No completed or failed quests match the current filters.</p>
          </UCard>
        </section>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      :title="editMode === 'create' ? 'Create quest' : 'Edit quest'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
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
