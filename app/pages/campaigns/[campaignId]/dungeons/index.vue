<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import type { DungeonCreateInput, DungeonImportInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonSummary } from '#shared/types/dungeon'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

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
const seedPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$/
type DungeonThemeOption = 'ruins' | 'cavern' | 'sewer' | 'crypt' | 'custom'
const dungeonThemeOptions = [
  { label: 'Ruins', value: 'ruins' },
  { label: 'Cavern', value: 'cavern' },
  { label: 'Sewer', value: 'sewer' },
  { label: 'Crypt', value: 'crypt' },
  { label: 'Custom', value: 'custom' },
]
const selectedThemeOption = ref<DungeonThemeOption>('ruins')
const customTheme = ref('')
const form = reactive<DungeonCreateInput>({
  name: '',
  theme: 'ruins',
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
const canCreateDungeon = computed(() =>
  !!form.name.trim()
  && (selectedThemeOption.value !== 'custom' || !!customTheme.value.trim()),
)
const normalizedSeed = computed(() => form.seed?.trim() || '')
const seedValidationMessage = computed(() => {
  if (!normalizedSeed.value) return ''
  if (seedPattern.test(normalizedSeed.value)) return ''
  return 'Use 3-80 characters: letters, numbers, hyphen, or underscore.'
})

const generateSeedSuggestion = () => {
  const value = Math.random().toString(36).slice(2, 10)
  form.seed = `dungeon-${value}`
}

const resetForm = () => {
  form.name = ''
  form.theme = 'ruins'
  form.seed = undefined
  selectedThemeOption.value = 'ruins'
  customTheme.value = ''
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
  if (!canCreateDungeon.value) { createError.value = 'Enter a name and theme.'; return }
  isCreating.value = true
  createError.value = ''

  const normalizedTheme = selectedThemeOption.value === 'custom'
    ? customTheme.value.trim()
    : selectedThemeOption.value

  if (!normalizedTheme) {
    createError.value = 'Custom theme is required.'
    isCreating.value = false
    return
  }

  if (normalizedSeed.value && !seedPattern.test(normalizedSeed.value)) {
    createError.value = seedValidationMessage.value
    isCreating.value = false
    return
  }

  try {
    const created = await dungeonApi.createDungeon(campaignId.value, {
      name: form.name,
      theme: normalizedTheme,
      seed: normalizedSeed.value || undefined,
    })
    if (!created) {
      throw new Error('Dungeon creation returned an empty response.')
    }
    isCreateOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/dungeons/${created.id}`)
  } catch (cause) {
    createError.value = (cause as Error).message || 'Unable to create dungeon.'
  } finally {
    isCreating.value = false
  }
}

const importDungeon = async () => {
  if (!canWriteContent.value || isCreating.value || isImporting.value) return
  if (!importForm.payload.trim()) { importError.value = 'Paste a dungeon export.'; return }
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
      throw new Error('Dungeon import returned an empty response.')
    }
    isImportOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/dungeons/${created.id}`)
  } catch (cause) {
    if (cause instanceof SyntaxError) {
      importError.value = 'Invalid JSON. Paste a valid dungeon export file.'
    } else {
      importError.value = (cause as Error).message || 'Unable to import dungeon.'
    }
  } finally {
    isImporting.value = false
  }
}

const deleteDungeon = async (dungeon: CampaignDungeonSummary) => {
  if (deletingDungeonId.value) throw new Error('Another dungeon deletion is in progress.')
  deleteError.value = ''
  deletingDungeonId.value = dungeon.id
  try {
    await dungeonApi.deleteDungeon(campaignId.value, dungeon.id)
    await refresh()
  } catch (cause) {
    deleteError.value = (cause as Error).message || 'Unable to delete dungeon.'
    throw cause
  } finally {
    deletingDungeonId.value = ''
  }
}
const dungeonActions = (dungeon: CampaignDungeonSummary): RecordAction[] => [
  { label: 'Open dungeon', icon: 'i-lucide-arrow-up-right', to: `/campaigns/${campaignId.value}/dungeons/${dungeon.id}` },
  ...(dungeon.canDelete ? [{ label: 'Delete dungeon', icon: 'i-lucide-trash-2', destructive: true, action: () => deleteDungeon(dungeon), confirmation: { modal: true, message: `Delete ${dungeon.name}? This removes its rooms, links, and snapshots.` } }] : []),
]
</script>

<template>
  <CampaignListTemplate
    headline="Campaign Tool"
    title="Dungeons"
    description="Generate and manage campaign dungeon maps."
    action-label="New dungeon"
    action-icon="i-lucide-plus"
    :action-disabled="!canWriteContent"
    @action="openCreate"
  >
    <template #actions>
      <UButton
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
        description="Your role can view dungeons but cannot create or edit them."
      />
    </template>

    <SharedResourceState
:pending="pending" :has-data="Boolean(dungeons?.length)" :error="error"
      :empty="!dungeons?.length" error-message="Unable to load dungeons." empty-message="No dungeons yet."
      @retry="refresh">
      <template #emptyActions><UButton v-if="canWriteContent" @click="openCreate">Create first dungeon</UButton></template>
      <div class="grid gap-4 md:grid-cols-2">
      <UCard
        v-for="dungeon in (dungeons as CampaignDungeonSummary[])"
        :key="dungeon.id"
        :ui="{ body: 'p-5' }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold"><NuxtLink :to="`/campaigns/${campaignId}/dungeons/${dungeon.id}`" class="hover:underline">{{ dungeon.name }}</NuxtLink></h3>
              <p class="text-xs text-muted">{{ dungeon.theme }} • seed: {{ dungeon.seed }}</p>
            </div>
            <UBadge :label="dungeon.status" variant="subtle" color="neutral" />
          </div>

          <div class="text-xs text-muted">
            Rooms: {{ dungeon.roomCount }} • Updated {{ new Date(dungeon.updatedAt).toLocaleString() }}
          </div>

          <div class="flex justify-end"><SharedActionMenu :name="dungeon.name" :items="dungeonActions(dungeon)" :disabled="Boolean(deletingDungeonId)" /></div>
        </div>
      </UCard>
    </div>
    </SharedResourceState>
    <p v-if="deleteError" class="text-sm text-error">{{ deleteError }}</p>

    <SharedEntityFormModal
v-model:open="isCreateOpen" title="Create dungeon"
      :state="{ ...form, selectedThemeOption, customTheme }" :saving="isCreating" :error="createError"
      submit-label="Create dungeon" @submit="createDungeon">
        <div class="space-y-4">
          <UFormField label="Name" required>
            <UInput v-model="form.name" placeholder="Ancient catacombs" />
          </UFormField>
          <UFormField label="Theme" required>
            <USelect
              v-model="selectedThemeOption"
              :items="dungeonThemeOptions"
            />
            <p class="mt-1 text-xs text-muted">
              Theme influences the dungeon's generated style and content flavor.
            </p>
          </UFormField>
          <UFormField v-if="selectedThemeOption === 'custom'" label="Custom theme" required>
            <UInput
              v-model="customTheme"
              placeholder="volcanic forge"
            />
          </UFormField>
          <UFormField label="Seed (optional)">
            <div class="space-y-2">
              <UInput v-model="form.seed" placeholder="e.g. crypt-2026-03-14" />
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs text-muted">
                  Same seed + same settings = same dungeon. Leave blank to auto-generate.
                </p>
                <UButton size="xs" variant="outline" @click="generateSeedSuggestion">
                  Generate seed
                </UButton>
              </div>
              <p v-if="seedValidationMessage" class="text-xs text-warning">{{ seedValidationMessage }}</p>
            </div>
          </UFormField>
        </div>
    </SharedEntityFormModal>

    <SharedEntityFormModal
v-model:open="isImportOpen" title="Import dungeon JSON"
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
  </CampaignListTemplate>
</template>

