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
        <p class="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-500">Quests</p>
        <h1 class="mt-2 text-2xl font-semibold">Quest tracker</h1>
      </div>
      <UButton size="lg" @click="openCreate">New quest</UButton>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse bg-white/80 dark:bg-slate-900/40" />
    </div>

    <div v-else-if="error" class="rounded-xl border border-dashed border-red-900/60 p-10 text-center">
      <p class="text-sm text-red-300">Unable to load quests.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </div>

    <div v-else-if="!quests?.length" class="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-10 text-center">
      <p class="text-sm text-slate-600 dark:text-slate-400">No quests yet.</p>
      <UButton class="mt-4" variant="outline" @click="openCreate">Create your first quest</UButton>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="quest in quests" :key="quest.id" class="border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">Quest</p>
              <h3 class="text-lg font-semibold">{{ quest.title }}</h3>
            </div>
            <div class="flex gap-2">
              <UButton size="xs" variant="outline" @click="openEdit(quest)">Edit</UButton>
              <UButton size="xs" color="red" variant="ghost" @click="deleteQuest(quest)">Delete</UButton>
            </div>
          </div>
        </template>
        <p class="text-sm text-slate-700 dark:text-slate-300">{{ quest.description || 'Add quest notes.' }}</p>
        <div class="mt-4 flex items-center justify-between gap-3">
          <select
            class="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-200"
            :value="quest.status"
            @change="updateStatus(quest, ($event.target as HTMLSelectElement).value as QuestItem['status'])"
          >
            <option v-for="status in statusOptions" :key="status.value" :value="status.value">
              {{ status.label }}
            </option>
          </select>
          <span class="text-xs text-slate-600 dark:text-slate-400">{{ quest.progressNotes || 'No progress notes.' }}</span>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #content>
        <UCard class="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <template #header>
            <h2 class="text-lg font-semibold">{{ editMode === 'create' ? 'Create quest' : 'Edit quest' }}</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Title</label>
              <UInput v-model="editForm.title" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Status</label>
              <select
                v-model="editForm.status"
                class="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                  {{ status.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Description</label>
              <UTextarea v-model="editForm.description" :rows="4" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-slate-700 dark:text-slate-300">Progress notes</label>
              <UTextarea v-model="editForm.progressNotes" :rows="3" />
            </div>
            <p v-if="editError" class="text-sm text-red-300">{{ editError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isEditOpen = false">Cancel</UButton>
              <UButton :loading="isSaving" @click="saveQuest">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
