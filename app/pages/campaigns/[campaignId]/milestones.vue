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

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
      <UCard v-for="i in 3" :key="i"  class="h-28 animate-pulse" />
    </div>

    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load milestones.</p>
      <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
    </UCard>

    <UCard v-else-if="!milestones?.length" class="text-center">
      <p class="text-sm text-muted">No milestones yet.</p>
      <UButton class="mt-4" variant="outline" @click="openCreate">Create your first milestone</UButton>
    </UCard>

    <div v-else class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="milestone in milestones"
        :key="milestone.id"
        
      >
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
      </UCard>
    </div>

    <UModal v-model:open="isEditOpen">
      <template #content>
        <UCard >
          <template #header>
            <h2 class="text-lg font-semibold">
              {{ editMode === 'create' ? 'Create milestone' : 'Edit milestone' }}
            </h2>
          </template>
          <div class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Title</label>
              <UInput v-model="editForm.title" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Description</label>
              <UTextarea v-model="editForm.description" :rows="4" />
            </div>
            <p v-if="editError" class="text-sm text-error">{{ editError }}</p>
          </div>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" color="gray" @click="isEditOpen = false">Cancel</UButton>
              <UButton :loading="isSaving" @click="saveMilestone">Save</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
