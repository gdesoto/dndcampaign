<script setup lang="ts">
definePageMeta({ layout: 'app' })

type QuestItem = {
  id: string
  title: string
  description?: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
  progressNotes?: string | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

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

const isEditOpen = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: '',
  title: '',
  description: '',
  status: 'ACTIVE',
  progressNotes: '',
})
const editError = ref('')
const isSaving = ref(false)

const openCreate = () => {
  editMode.value = 'create'
  editError.value = ''
  editForm.id = ''
  editForm.title = ''
  editForm.description = ''
  editForm.status = 'ACTIVE'
  editForm.progressNotes = ''
  isEditOpen.value = true
}

const openEdit = (quest: QuestItem) => {
  editMode.value = 'edit'
  editError.value = ''
  editForm.id = quest.id
  editForm.title = quest.title
  editForm.description = quest.description || ''
  editForm.status = quest.status
  editForm.progressNotes = quest.progressNotes || ''
  isEditOpen.value = true
}

const saveQuest = async () => {
  editError.value = ''
  isSaving.value = true
  try {
    if (editMode.value === 'create') {
      await request(`/api/campaigns/${campaignId.value}/quests`, {
        method: 'POST',
        body: {
          title: editForm.title,
          description: editForm.description || undefined,
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
  await request(`/api/quests/${quest.id}`, { method: 'DELETE' })
  await refresh()
}

const updateStatus = async (quest: QuestItem, status: QuestItem['status']) => {
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
      <UButton size="lg" @click="openCreate">New quest</UButton>
    </div>

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
        <UButton variant="outline" @click="openCreate">Create your first quest</UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <SharedListItemCard v-for="quest in quests" :key="quest.id">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Quest</p>
                <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
              </div>
              <div class="flex gap-2">
                <UButton size="xs" variant="outline" @click="openEdit(quest)">Edit</UButton>
                <UButton size="xs" color="red" variant="ghost" @click="deleteQuest(quest)">Delete</UButton>
              </div>
            </div>
          </template>
          <p class="text-sm text-default">{{ quest.description || 'Add quest notes.' }}</p>
          <div class="mt-4 flex items-center justify-between gap-3">
            <USelect
              :items="statusOptions"
              :model-value="quest.status"
              @update:model-value="(value) => updateStatus(quest, value as QuestItem['status'])"
            />
            <span class="text-xs text-muted">{{ quest.progressNotes || 'No progress notes.' }}</span>
          </div>
        </SharedListItemCard>
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
