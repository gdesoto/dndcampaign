<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { encounterMapCreateSchema, type EncounterMapCreateInput, type EncounterMapImportInput } from '#shared/schemas/encounter-map'
import type { CampaignEncounterMapSummary } from '#shared/types/encounter-map'
import { createEncounterMapConfig, encounterMapTypes } from '~/utils/encounter-map-options'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const encounterMapApi = useEncounterMaps()
const isCreateOpen = ref(false)
const isImportOpen = ref(false)
const isCreating = ref(false)
const isImporting = ref(false)
const deletingEncounterMapId = ref('')
const createError = ref('')
const importError = ref('')
const generationSettings = ref(createEncounterMapConfig())
const form = reactive<Pick<EncounterMapCreateInput, 'name' | 'seed'>>({
  name: '',
  seed: undefined,
})
const importForm = reactive({
  nameOverride: '',
  payload: '',
})

const retainedEncounterMaps = useRetainedResource<Awaited<ReturnType<typeof encounterMapApi.listEncounterMaps>>>(() => campaignId.value)
const {
  data: encounterMaps,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `encounter-maps-${campaignId.value}`,
  () => retainedEncounterMaps.load(() => encounterMapApi.listEncounterMaps(campaignId.value)),
  { default: retainedEncounterMaps.get },
)
retainedEncounterMaps.seed(encounterMaps.value)
const canCreateEncounterMap = computed(() => !!form.name.trim())
const normalizedSeed = computed(() => form.seed?.trim() || '')

const resetForm = () => {
  form.name = ''
  form.seed = undefined
  generationSettings.value = createEncounterMapConfig()
}

const openCreate = () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  createError.value = ''
  resetForm()
  isCreateOpen.value = true
}

const openImport = () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  importError.value = ''
  importForm.nameOverride = ''
  importForm.payload = ''
  isImportOpen.value = true
}

const createEncounterMap = async () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  if (!canCreateEncounterMap.value) { createError.value = 'Enter a name.'; return }
  isCreating.value = true
  createError.value = ''

  try {
    const config = createEncounterMapConfig(generationSettings.value)
    const created = await encounterMapApi.createEncounterMap(campaignId.value, {
      name: form.name,
      theme: config.theme,
      seed: normalizedSeed.value || undefined,
      config,
    })
    if (!created) {
      throw new Error('Map creation returned an empty response.')
    }
    isCreateOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/encounter-maps/${created.id}`)
  } catch (cause) {
    createError.value = (cause as Error).message || 'Unable to create encounter map.'
  } finally {
    isCreating.value = false
  }
}

const importEncounterMap = async () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  if (!importForm.payload.trim()) { importError.value = 'Paste a map export.'; return }
  isImporting.value = true
  importError.value = ''
  try {
    const parsed = JSON.parse(importForm.payload) as unknown
    const payload: EncounterMapImportInput = {
      source: parsed as EncounterMapImportInput['source'],
      nameOverride: importForm.nameOverride.trim() || undefined,
    }
    const created = await encounterMapApi.importEncounterMap(campaignId.value, payload)
    if (!created?.id) {
      throw new Error('Map import returned an empty response.')
    }
    isImportOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/encounter-maps/${created.id}`)
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      importError.value = 'Invalid JSON. Paste a valid map export file.'
    } else {
      importError.value = (cause as Error).message || 'Unable to import map.'
    }
  } finally {
    isImporting.value = false
  }
}

const deleteEncounterMap = async (encounterMap: CampaignEncounterMapSummary) => {
  if (deletingEncounterMapId.value) throw new Error('Another map deletion is in progress.')
  deletingEncounterMapId.value = encounterMap.id
  try {
    await encounterMapApi.deleteEncounterMap(campaignId.value, encounterMap.id)
    await refresh()
  } finally {
    deletingEncounterMapId.value = ''
  }
}
const encounterMapActions = (encounterMap: CampaignEncounterMapSummary): RecordAction[] => [
  { label: 'Open', icon: 'i-lucide-arrow-up-right', to: `/campaigns/${campaignId.value}/encounter-maps/${encounterMap.id}` },
  ...(encounterMap.canDelete ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => deleteEncounterMap(encounterMap), confirmation: { modal: true, message: `Delete ${encounterMap.name}? This removes its rooms, links, and snapshots.` } }] : []),
]
</script>

<template>
  <CampaignTemplatesList
    title="Encounter maps"
    :count="encounterMaps?.length"
    :action-label="canWriteContent ? 'New map' : ''"
    action-icon="i-lucide-plus"
    :action-disabled="!canWriteContent"
    @action="openCreate"
  >
    <template #actions>
      <UButton
        v-if="canWriteContent"
        icon="i-lucide-file-up"
        variant="outline"
        :disabled="!canWriteContent"
        @click="openImport"
      >
        Import JSON
      </UButton>
    </template>

    <template #notice>
      <SharedReadOnlyAlert
        v-if="!canWriteContent"
        description="Your role can view encounter maps but cannot create or edit them."
      />
    </template>

    <SharedResourceState
:pending="pending" :has-data="Boolean(encounterMaps?.length)" :error="error"
      :empty="!encounterMaps?.length" error-message="Unable to load encounter maps." empty-message="No encounter maps yet."
      @retry="refresh">
      <template #emptyActions><UButton v-if="canWriteContent" @click="openCreate">Generate first map</UButton></template>
      <div class="grid gap-4 md:grid-cols-2">
      <UCard
        v-for="encounterMap in (encounterMaps as CampaignEncounterMapSummary[])"
        :key="encounterMap.id"
        :ui="{ body: 'p-5' }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="type-record flex items-start gap-2"><UIcon :name="encounterMapTypes.find(item => item.value === encounterMap.mapType)?.icon || 'i-lucide-castle'" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /><NuxtLink :to="`/campaigns/${campaignId}/encounter-maps/${encounterMap.id}`" class="break-words hover:underline">{{ encounterMap.name }}</NuxtLink></h2>
              <UBadge color="neutral" variant="soft" class="mt-2">{{ encounterMapTypes.find(item => item.value === encounterMap.mapType)?.label || 'Dungeon' }}</UBadge>
            </div>
            <SharedActionMenu :name="encounterMap.name" :items="encounterMapActions(encounterMap)" :disabled="Boolean(deletingEncounterMapId)" />
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
            <UBadge :label="encounterMap.status.charAt(0) + encounterMap.status.slice(1).toLowerCase()" variant="soft" color="neutral" />
            <span class="flex items-center gap-1"><UIcon name="i-lucide-door-open" class="size-4" aria-hidden="true" />{{ encounterMap.roomCount }} {{ encounterMap.mapType === 'FOREST' ? 'clearings' : 'rooms' }}</span>
            <span v-if="(encounterMap.floorCount || 1) > 1">{{ encounterMap.floorCount }} floors</span>
            <time :datetime="encounterMap.updatedAt">Updated {{ new Date(encounterMap.updatedAt).toLocaleDateString() }}</time>
          </div>

        </div>
      </UCard>
    </div>
    </SharedResourceState>

    <SharedEntityFormModal
v-model:open="isCreateOpen" title="Generate encounter map"
      :state="{ ...form, seed: normalizedSeed || undefined, theme: generationSettings.theme, config: generationSettings }" :schema="encounterMapCreateSchema" :saving="isCreating" :error="createError"
      submit-label="Generate map" @submit="createEncounterMap">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="Ancient catacombs" />
          </UFormField>
          <EncounterMapGeneratorOptions v-model="generationSettings" v-model:seed="form.seed" :disabled="isCreating" seed-placeholder="Blank for a random map" />
        </div>
    </SharedEntityFormModal>

    <SharedEntityFormModal
v-model:open="isImportOpen" title="Import map JSON"
      :state="importForm" :saving="isImporting" :error="importError"
      submit-label="Import" @submit="importEncounterMap">
        <div class="space-y-4">
          <UFormField label="Name override (optional)">
            <UInput v-model="importForm.nameOverride" placeholder="Use imported name if blank" />
          </UFormField>
          <UFormField label="Export JSON payload" required>
            <UTextarea
              v-model="importForm.payload"
              :rows="12"
              placeholder="Paste the full JSON export document here"
            />
          </UFormField>
        </div>
    </SharedEntityFormModal>
  </CampaignTemplatesList>
</template>

