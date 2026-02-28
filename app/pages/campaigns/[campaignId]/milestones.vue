<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
definePageMeta({ layout: 'dashboard' })

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
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

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
  if (!canWriteContent.value) return
  editMode.value = 'create'
  editError.value = ''
  editForm.id = ''
  editForm.title = ''
  editForm.description = ''
  isEditOpen.value = true
}

const openEdit = (milestone: MilestoneItem) => {
  if (!canWriteContent.value) return
  editMode.value = 'edit'
  editError.value = ''
  editForm.id = milestone.id
  editForm.title = milestone.title
  editForm.description = milestone.description || ''
  isEditOpen.value = true
}

const saveMilestone = async () => {
  if (!canWriteContent.value) return
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
  if (!canWriteContent.value) return
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
  <div class="space-y-6">
    <CampaignListTemplate
      headline="Milestones"
      title="Milestone board"
      description="Track campaign progress, completion, and key beats."
      action-label="New milestone"
      action-icon="i-lucide-plus"
      :action-disabled="!canWriteContent"
      @action="openCreate"
    >
      <template #notice>
        <UAlert
          v-if="!canWriteContent"
          color="warning"
          variant="subtle"
          title="Read-only access"
          description="Your role can view milestones but cannot modify them."
        />
      </template>

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
          <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first milestone</UButton>
        </template>

        <div class="grid gap-4 sm:grid-cols-2">
          <SharedListItemCard v-for="milestone in milestones" :key="milestone.id">
            <template #header>
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Milestone</p>
                  <h3 class="text-lg font-semibold">{{ milestone.title }}</h3>
                </div>
                <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="openEdit(milestone)">Edit</UButton>
              </div>
            </template>
            <p class="text-sm whitespace-pre-line text-default">{{ milestone.description || 'Add details about this milestone.' }}</p>
            <div class="mt-4 flex items-center justify-between gap-3">
              <span class="text-xs text-muted">
                {{ milestone.isComplete ? 'Completed' : 'In progress' }}
              </span>
              <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="toggleComplete(milestone)">
                {{ milestone.isComplete ? 'Mark incomplete' : 'Mark complete' }}
              </UButton>
            </div>
          </SharedListItemCard>
        </div>
      </SharedResourceState>
    </CampaignListTemplate>

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

