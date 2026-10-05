<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import { dungeonCreateSchema, type DungeonCreateInput, type DungeonImportInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonSummary } from '#shared/types/dungeon'
import { createEncounterMapConfig, encounterMapTypes } from '~/utils/encounter-map-options'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const dungeonApi = useDungeonList()
const isCreateOpen = ref(false)
const isImportOpen = ref(false)
const isCreating = ref(false)
const isImporting = ref(false)
const deletingDungeonId = ref('')
const createError = ref('')
const importError = ref('')
const deleteError = ref('')
const generationSettings = ref(createEncounterMapConfig())
const form = reactive<Pick<DungeonCreateInput, 'name' | 'seed'>>({
  name: '',
  seed: undefined,
})
const importForm = reactive({
  nameOverride: '',
  payload: '',
})

const retainedDungeons = useRetainedResource<Awaited<ReturnType<typeof dungeonApi.listDungeons>>>(() => campaignId.value)
const {
  data: dungeons,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `dungeons-${campaignId.value}`,
  () => retainedDungeons.load(() => dungeonApi.listDungeons(campaignId.value)),
  { default: retainedDungeons.get },
)
retainedDungeons.seed(dungeons.value)
const canCreateDungeon = computed(() => !!form.name.trim())
const normalizedSeed = computed(() => form.seed?.trim() || '')

const generateSeedSuggestion = () => {
  const value = Math.random().toString(36).slice(2, 10)
  form.seed = `map-${value}`
}

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

const createDungeon = async () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  if (!canCreateDungeon.value) { createError.value = 'Enter a name.'; return }
  isCreating.value = true
  createError.value = ''

  try {
    const config = createEncounterMapConfig(generationSettings.value)
    const created = await dungeonApi.createDungeon(campaignId.value, {
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
    await navigateTo(`/campaigns/${campaignId.value}/dungeons/${created.id}`)
  } catch (cause) {
    createError.value = (cause as Error).message || 'Unable to create encounter map.'
  } finally {
    isCreating.value = false
  }
}

const importDungeon = async () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  if (!importForm.payload.trim()) { importError.value = 'Paste a map export.'; return }
  isImporting.value = true
  importError.value = ''
  try {
    const parsed = JSON.parse(importForm.payload) as unknown
    const payload: DungeonImportInput = {
      source: parsed as DungeonImportInput['source'],
      nameOverride: importForm.nameOverride.trim() || undefined,
    }
    const created = await dungeonApi.importDungeon(campaignId.value, payload)
    if (!created?.id) {
      throw new Error('Map import returned an empty response.')
    }
    isImportOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/dungeons/${created.id}`)
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

const deleteDungeon = async (dungeon: CampaignDungeonSummary) => {
  if (deletingDungeonId.value) throw new Error('Another map deletion is in progress.')
  deleteError.value = ''
  deletingDungeonId.value = dungeon.id
  try {
    await dungeonApi.deleteDungeon(campaignId.value, dungeon.id)
    await refresh()
  } catch (cause) {
    deleteError.value = (cause as Error).message || 'Unable to delete map.'
    throw cause
  } finally {
    deletingDungeonId.value = ''
  }
}
const dungeonActions = (dungeon: CampaignDungeonSummary): RecordAction[] => [
  { label: 'Open', icon: 'i-lucide-arrow-up-right', to: `/campaigns/${campaignId.value}/dungeons/${dungeon.id}` },
  ...(dungeon.canDelete ? [{ label: 'Delete', icon: 'i-lucide-trash-2', destructive: true, action: () => deleteDungeon(dungeon), confirmation: { modal: true, message: `Delete ${dungeon.name}? This removes its rooms, links, and snapshots.` } }] : []),
]
</script>

<template>
  <CampaignTemplatesList
    title="Encounter maps"
    :count="dungeons?.length"
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
:pending="pending" :has-data="Boolean(dungeons?.length)" :error="error"
      :empty="!dungeons?.length" error-message="Unable to load encounter maps." empty-message="No encounter maps yet."
      @retry="refresh">
      <template #emptyActions><UButton v-if="canWriteContent" @click="openCreate">Generate first map</UButton></template>
      <div class="grid gap-4 md:grid-cols-2">
      <UCard
        v-for="dungeon in (dungeons as CampaignDungeonSummary[])"
        :key="dungeon.id"
        :ui="{ body: 'p-5' }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="type-record flex items-start gap-2"><UIcon :name="encounterMapTypes.find(item => item.value === dungeon.mapType)?.icon || 'i-lucide-castle'" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" /><NuxtLink :to="`/campaigns/${campaignId}/dungeons/${dungeon.id}`" class="break-words hover:underline">{{ dungeon.name }}</NuxtLink></h2>
              <UBadge color="neutral" variant="soft" class="mt-2">{{ encounterMapTypes.find(item => item.value === dungeon.mapType)?.label || 'Dungeon' }}</UBadge>
            </div>
            <SharedActionMenu :name="dungeon.name" :items="dungeonActions(dungeon)" :disabled="Boolean(deletingDungeonId)" />
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
            <UBadge :label="dungeon.status.charAt(0) + dungeon.status.slice(1).toLowerCase()" variant="soft" color="neutral" />
            <span class="flex items-center gap-1"><UIcon name="i-lucide-door-open" class="size-4" aria-hidden="true" />{{ dungeon.roomCount }} {{ dungeon.mapType === 'FOREST' ? 'clearings' : 'rooms' }}</span>
            <span v-if="(dungeon.floorCount || 1) > 1">{{ dungeon.floorCount }} floors</span>
            <time :datetime="dungeon.updatedAt">Updated {{ new Date(dungeon.updatedAt).toLocaleDateString() }}</time>
          </div>

        </div>
      </UCard>
    </div>
    </SharedResourceState>
    <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>

    <SharedEntityFormModal
v-model:open="isCreateOpen" title="Generate encounter map"
      :state="{ ...form, seed: normalizedSeed || undefined, theme: generationSettings.theme, config: generationSettings }" :schema="dungeonCreateSchema" :saving="isCreating" :error="createError"
      submit-label="Generate map" @submit="createDungeon">
        <div class="space-y-4">
          <UFormField label="Name" name="name" required>
            <UInput v-model="form.name" placeholder="Ancient catacombs" />
          </UFormField>
          <DungeonGeneratorOptions v-model="generationSettings" :disabled="isCreating" />
          <UFormField label="Seed (optional)" name="seed">
            <div class="space-y-2">
              <UInput v-model="form.seed" placeholder="e.g. crypt-2026-03-14" />
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs text-muted">
                  Leave blank for a random map. Reuse a seed and settings to repeat a layout.
                </p>
                <UButton size="xs" variant="outline" @click="generateSeedSuggestion">
                  Generate seed
                </UButton>
              </div>
            </div>
          </UFormField>
        </div>
    </SharedEntityFormModal>

    <SharedEntityFormModal
v-model:open="isImportOpen" title="Import map JSON"
      :state="importForm" :saving="isImporting" :error="importError"
      submit-label="Import" @submit="importDungeon">
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

