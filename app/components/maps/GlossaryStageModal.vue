<script setup lang="ts">
import type { MapGlossaryCommitResultDto, MapGlossaryStageResultDto, MapStageAction } from '#shared/types/api/map'

const props = defineProps<{
  open: boolean
  campaignId: string
  mapId: string
  featureIds: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  committed: [value: MapGlossaryCommitResultDto]
}>()

const { request } = useApi()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

type ItemState = {
  featureId: string
  featureName: string
  featureType: string
  hasConflict: boolean
  conflictCandidates: Array<{
    glossaryEntryId: string
    name: string
    type: string
    confidence: number
    reasons: string[]
  }>
  action: MapStageAction
  glossaryEntryId: string
  payload: {
    type: 'LOCATION'
    name: string
    aliases: string
    description: string
  }
}

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const items = ref<ItemState[]>([])

const actionItems = [
  { label: 'Create', value: 'create' },
  { label: 'Link', value: 'link' },
  { label: 'Merge', value: 'merge' },
  { label: 'Skip', value: 'skip' },
]

const loadStage = async () => {
  if (!openModel.value || !props.featureIds.length) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await request<MapGlossaryStageResultDto>(
      `/api/campaigns/${props.campaignId}/maps/${props.mapId}/glossary/stage`,
      {
        method: 'POST',
        body: {
          featureIds: props.featureIds,
        },
      }
    )
    items.value = response.items.map((item) => ({
      featureId: item.featureId,
      featureName: item.featureName,
      featureType: item.featureType,
      hasConflict: item.hasConflict,
      conflictCandidates: item.conflictCandidates,
      action: item.defaultAction,
      glossaryEntryId: item.conflictCandidates[0]?.glossaryEntryId || '',
      payload: {
        type: 'LOCATION',
        name: item.suggestedGlossary.name,
        aliases: item.suggestedGlossary.aliases || '',
        description: item.suggestedGlossary.description,
      },
    }))
  } catch (error) {
    errorMessage.value =
      (error as Error).message || 'Unable to stage glossary entries for selected features.'
  } finally {
    loading.value = false
  }
}

watch(
  () => [openModel.value, props.featureIds.join(','), props.mapId],
  () => {
    if (openModel.value) {
      loadStage()
    } else {
      items.value = []
      errorMessage.value = ''
    }
  }
)

const commit = async () => {
  saving.value = true
  errorMessage.value = ''
  try {
    const result = await request<MapGlossaryCommitResultDto>(
      `/api/campaigns/${props.campaignId}/maps/${props.mapId}/glossary/commit`,
      {
        method: 'POST',
        body: {
          items: items.value.map((item) => ({
            featureId: item.featureId,
            action: item.action,
            glossaryEntryId:
              item.action === 'link' || item.action === 'merge'
                ? item.glossaryEntryId || undefined
                : undefined,
            glossaryPayload: item.action === 'create'
              ? {
                  type: item.payload.type,
                  name: item.payload.name,
                  aliases: item.payload.aliases || undefined,
                  description: item.payload.description,
                }
              : undefined,
          })),
        },
      }
    )
    emit('committed', result)
    openModel.value = false
  } catch (error) {
    errorMessage.value =
      (error as Error).message || 'Unable to commit glossary staging decisions.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :dismissible="!saving"
    title="Glossary staging"
    description="Review selected map features and choose how each should be committed to the glossary."
  >
    <template #content>
      <UCard class="max-h-[80vh] overflow-hidden">
        <template #header>
          <div>
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Glossary staging</p>
            <h2 class="mt-1 text-lg font-semibold">Review feature actions</h2>
          </div>
        </template>

        <div class="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
          <div v-if="loading" class="space-y-2">
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
            <USkeleton class="h-20 w-full" />
          </div>
          <template v-else>
            <UCard v-for="item in items" :key="item.featureId" class="theme-panel">
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold">{{ item.featureName }}</p>
                    <p class="text-xs uppercase tracking-[0.2em] text-dimmed">{{ item.featureType }}</p>
                  </div>
                  <UBadge :color="item.hasConflict ? 'warning' : 'success'" variant="subtle">
                    {{ item.hasConflict ? 'Conflict detected' : 'No conflict' }}
                  </UBadge>
                </div>

                <UFormField label="Action">
                  <USelect v-model="item.action" :items="actionItems" />
                </UFormField>

                <UFormField
                  v-if="item.action === 'link' || item.action === 'merge'"
                  label="Existing glossary entry"
                >
                  <USelect
                    v-model="item.glossaryEntryId"
                    :items="item.conflictCandidates.map((candidate) => ({
                      label: `${candidate.name} (${Math.round(candidate.confidence * 100)}%)`,
                      value: candidate.glossaryEntryId,
                    }))"
                    placeholder="Select an entry"
                  />
                </UFormField>

                <div v-if="item.action === 'create'" class="grid gap-2">
                  <UFormField label="Name">
                    <UInput v-model="item.payload.name" />
                  </UFormField>
                  <UFormField label="Aliases">
                    <UInput v-model="item.payload.aliases" placeholder="Comma separated aliases" />
                  </UFormField>
                  <UFormField label="Description">
                    <UTextarea v-model="item.payload.description" :rows="3" />
                  </UFormField>
                </div>
              </div>
            </UCard>
            <p v-if="!items.length" class="text-sm text-muted">No features selected for staging.</p>
          </template>
        </div>

        <template #footer>
          <div class="flex items-center justify-between gap-3">
            <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
            <div class="ml-auto flex gap-2">
              <UButton variant="ghost" color="neutral" :disabled="saving" @click="openModel = false">
                Cancel
              </UButton>
              <UButton :loading="saving" :disabled="loading || !items.length" @click="commit">
                Commit actions
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
