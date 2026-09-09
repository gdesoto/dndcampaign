<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { titledEntityFormSchema } from '~/utils/entity-form-schemas'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
definePageMeta({ layout: 'dashboard' })

type MilestoneItem = {
  id: string
  title: string
  description?: string | null
  isComplete: boolean
  completedAt?: string | null
}

const { campaignId, request, canWriteContent } = useCampaignPageContext()

const { data: milestones, pending, refresh, error } = await useAsyncData(
  () => `milestones-${campaignId.value}`,
  () => request<MilestoneItem[]>(`/api/campaigns/${campaignId.value}/milestones`)
)


const {
  isOpen: isEditOpen,
  mode: editMode,
  form: editForm,
  error: editError,
  isSaving,
  openCreate: openMilestoneCreate,
  openEdit: openMilestoneEdit,
  saveWith: saveMilestoneWith,
} = useCrudModal(() => ({
  id: '',
  title: '',
  description: '',
}))

const deletingMilestoneId = ref<string | null>(null)

const openCreate = () => {
  if (!canWriteContent.value) return
  openMilestoneCreate()
}

const openEdit = (milestone: MilestoneItem) => {
  if (!canWriteContent.value) return
  openMilestoneEdit({
    id: milestone.id,
    title: milestone.title,
    description: milestone.description || '',
  })
}

const saveMilestone = async () => {
  if (!canWriteContent.value) return
  await saveMilestoneWith(async ({ mode, form }) => {
    if (mode === 'create') {
      await request(`/api/campaigns/${campaignId.value}/milestones`, {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description || undefined,
        },
      })
    } else {
      await request(`/api/milestones/${form.id}`, {
        method: 'PATCH',
        body: {
          title: form.title,
          description: form.description || null,
        },
      })
    }
    await refresh()
  }, 'Unable to save milestone.')
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

const deleteMilestone = async (milestone: MilestoneItem) => {
  if (!canWriteContent.value) return

  deletingMilestoneId.value = milestone.id

  try {
    await request(`/api/milestones/${milestone.id}`, {
      method: 'DELETE',
    })
    await refresh()
  } finally {
    deletingMilestoneId.value = null
  }
}

const deleteEditingMilestone = async () => {
  if (editMode.value !== 'edit') return
  const milestone = (milestones.value || []).find((item) => item.id === editForm.id)
  if (!milestone) return

  await deleteMilestone(milestone)
  isEditOpen.value = false
}
const milestoneActions = (milestone: MilestoneItem): RecordAction[] => canWriteContent.value ? [
  { label: 'Edit', icon: 'i-lucide-pencil', action: () => openEdit(milestone) },
  { label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => deleteMilestone(milestone), confirmation: { message: `Delete milestone "${milestone.title}"? This cannot be undone.` } },
] : []

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
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can view milestones but cannot modify them."
        />
      </template>

      <SharedResourceState
:has-data="Boolean(milestones?.length)"
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
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Milestone</p>
                  <h3 class="text-lg font-semibold">{{ milestone.title }}</h3>
                </div>
                <SharedActionMenu :name="milestone.title" :items="milestoneActions(milestone)" :disabled="Boolean(deletingMilestoneId)" />
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
:schema="titledEntityFormSchema"
      :state="editForm"
      :title="editMode === 'create' ? 'Create milestone' : 'Edit milestone'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      :show-delete-action="editMode === 'edit'"
      :delete-loading="deletingMilestoneId === editForm.id"
      @delete="deleteEditingMilestone"
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


