<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { titledEntityFormSchema } from '~/utils/entity-form-schemas'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
import CampaignProgressBadge from '~/components/campaign/ProgressBadge.vue'
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
const completingId = ref('')
const completionError = ref('')

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
  if (!canWriteContent.value || completingId.value) return
  completingId.value = milestone.id
  completionError.value = ''
  const next = !milestone.isComplete
  try {
    await request(`/api/milestones/${milestone.id}`, {
    method: 'PATCH',
    body: {
      isComplete: next,
      completedAt: next ? new Date().toISOString() : null,
    },
  })
    await refresh()
  } catch (cause) {
    completionError.value = (cause as Error).message || 'Unable to update milestone.'
  } finally { completingId.value = '' }
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
      title="Milestones"
      :count="milestones?.length"
      :action-label="canWriteContent ? 'New milestone' : ''"
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
        :has-data="Boolean(milestones)"
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
          <UButton v-if="canWriteContent" variant="outline" @click="openCreate">Create your first milestone</UButton>
        </template>

        <p v-if="completionError" role="alert" class="text-sm text-error">{{ completionError }}</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <SharedListItemCard v-for="milestone in milestones" :key="milestone.id">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-start gap-2">
                  <UIcon name="i-lucide-flag" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <h2 class="type-record break-words">{{ milestone.title }}</h2>
                </div>
                <SharedActionMenu :name="milestone.title" :items="milestoneActions(milestone)" :disabled="Boolean(deletingMilestoneId)" />
              </div>
            </template>
            <p v-if="milestone.description" class="reading-copy whitespace-pre-line text-default">{{ milestone.description }}</p>
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <CampaignProgressBadge :status="milestone.isComplete ? 'COMPLETED' : 'IN_PROGRESS'" />
              <UButton v-if="canWriteContent" size="sm" :icon="milestone.isComplete ? 'i-lucide-rotate-ccw' : 'i-lucide-check'" variant="outline" :loading="completingId === milestone.id" :disabled="Boolean(completingId || deletingMilestoneId)" @click="toggleComplete(milestone)">
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
      :delete-action="deleteEditingMilestone"
      :record-name="editForm.title"
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


