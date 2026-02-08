<script setup lang="ts">
definePageMeta({ layout: 'app' })

type MilestoneItem = {
  id: string
  title: string
  description?: string | null
  isComplete: boolean
  completedAt?: string | null
}

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const { request } = useApi()

const { data: milestones, pending, refresh, error } = await useAsyncData(
  () => `milestones-${campaignId.value}`,
  () => request<MilestoneItem[]>(`/api/campaigns/${campaignId.value}/milestones`)
)

const isEditOpen = ref(false)
const editMode = ref<'create' | 'edit'>('create')
const editForm = reactive({
  id: '',
  title: '',
  description: '',
})
const editError = ref('')
const isSaving = ref(false)

const openCreate = () => {
  editMode.value = 'create'
  editError.value = ''
  editForm.id = ''
  editForm.title = ''
  editForm.description = ''
  isEditOpen.value = true
}

const openEdit = (milestone: MilestoneItem) => {
  editMode.value = 'edit'
  editError.value = ''
  editForm.id = milestone.id
  editForm.title = milestone.title
  editForm.description = milestone.description || ''
  isEditOpen.value = true
}

const saveMilestone = async () => {
  editError.value = ''
  isSaving.value = true
  try {
    if (editMode.value === 'create') {
      await request(`/api/campaigns/${campaignId.value}/milestones`, {
        method: 'POST',
        body: {
          title: editForm.title,
          description: editForm.description || undefined,
        },
      })
    } else {
      await request(`/api/milestones/${editForm.id}`, {
        method: 'PATCH',
        body: {
          title: editForm.title,
          description: editForm.description || null,
        },
      })
    }
    isEditOpen.value = false
    await refresh()
  } catch (error) {
    editError.value =
      (error as Error & { message?: string }).message || 'Unable to save milestone.'
  } finally {
    isSaving.value = false
  }
}

const toggleComplete = async (milestone: MilestoneItem) => {
  const next = !milestone.isComplete
  await request(`/api/milestones/${milestone.id}`, {
    method: 'PATCH',
    body: {
      isComplete: next,
      completedAt: next ? new Date().toISOString() : null,
    },
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Milestones</p>
        <h1 class="mt-2 text-2xl font-semibold">Milestone board</h1>
      </div>
      <UButton size="lg" @click="openCreate">New milestone</UButton>
    </div>

    <SharedResourceState
      :pending="pending"
      :error="error"
      :empty="!milestones?.length"
      error-message="Unable to load milestones."
      empty-message="No milestones yet."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard v-for="i in 3" :key="i" class="h-28 animate-pulse" />
        </div>
      </template>
      <template #emptyActions>
        <UButton variant="outline" @click="openCreate">Create your first milestone</UButton>
      </template>

      <div class="grid gap-4 sm:grid-cols-2">
        <SharedListItemCard v-for="milestone in milestones" :key="milestone.id">
          <template #header>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Milestone</p>
                <h3 class="text-lg font-semibold">{{ milestone.title }}</h3>
              </div>
              <UButton size="xs" variant="outline" @click="openEdit(milestone)">Edit</UButton>
            </div>
          </template>
          <p class="text-sm text-default">{{ milestone.description || 'Add details about this milestone.' }}</p>
          <div class="mt-4 flex items-center justify-between gap-3">
            <span class="text-xs text-muted">
              {{ milestone.isComplete ? 'Completed' : 'In progress' }}
            </span>
            <UButton size="xs" variant="outline" @click="toggleComplete(milestone)">
              {{ milestone.isComplete ? 'Mark incomplete' : 'Mark complete' }}
            </UButton>
          </div>
        </SharedListItemCard>
      </div>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      :title="editMode === 'create' ? 'Create milestone' : 'Edit milestone'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      @submit="saveMilestone"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="editForm.title" />
      </UFormField>
      <UFormField label="Description" name="description">
        <UTextarea v-model="editForm.description" :rows="4" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>
