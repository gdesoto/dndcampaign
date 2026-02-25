<script setup lang="ts">
import type { DungeonCreateInput, DungeonImportInput } from '#shared/schemas/dungeon'
import type { CampaignDungeonSummary } from '#shared/types/dungeon'

definePageMeta({ layout: 'default' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))

const dungeonApi = useDungeonList()
const isCreateOpen = ref(false)
const isImportOpen = ref(false)
const isCreating = ref(false)
const isImporting = ref(false)
const createError = ref('')
const importError = ref('')
const form = reactive<DungeonCreateInput>({
  name: '',
  theme: 'ruins',
  seed: undefined,
})
const importForm = reactive({
  nameOverride: '',
  payload: '',
})

const {
  data: dungeons,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `dungeons-${campaignId.value}`,
  () => dungeonApi.listDungeons(campaignId.value),
)

const resetForm = () => {
  form.name = ''
  form.theme = 'ruins'
  form.seed = undefined
}

const openCreate = () => {
  if (!canWriteContent.value) return
  createError.value = ''
  resetForm()
  isCreateOpen.value = true
}

const openImport = () => {
  if (!canWriteContent.value) return
  importError.value = ''
  importForm.nameOverride = ''
  importForm.payload = ''
  isImportOpen.value = true
}

const createDungeon = async () => {
  if (!canWriteContent.value) return
  isCreating.value = true
  createError.value = ''

  try {
    const created = await dungeonApi.createDungeon(campaignId.value, {
      name: form.name,
      theme: form.theme,
      seed: form.seed || undefined,
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
  if (!canWriteContent.value) return
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
</script>

<template>
  <div class="space-y-6">
    <UPageHeader
      title="Dungeons"
      description="Generate and manage campaign dungeon maps."
      headline="Campaign Tool"
    >
      <template #right>
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-file-up"
            variant="outline"
            :disabled="!canWriteContent"
            @click="openImport"
          >
            Import JSON
          </UButton>
          <UButton
            icon="i-lucide-plus"
            :disabled="!canWriteContent"
            @click="openCreate"
          >
            New dungeon
          </UButton>
        </div>
      </template>
    </UPageHeader>

    <UAlert
      v-if="!canWriteContent"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="Your role can view dungeons but cannot create or edit them."
    />

    <UCard v-if="pending" :ui="{ body: 'p-6' }">
      <p class="text-sm text-muted">Loading dungeons...</p>
    </UCard>

    <UCard v-else-if="error" :ui="{ body: 'p-6' }">
      <p class="text-sm text-error">Unable to load dungeons.</p>
      <UButton class="mt-3" variant="outline" @click="() => refresh()">Try again</UButton>
    </UCard>

    <UCard v-else-if="!(dungeons || []).length" :ui="{ body: 'p-6' }">
      <p class="text-sm text-muted">No dungeons yet.</p>
      <UButton v-if="canWriteContent" class="mt-3" @click="openCreate">Create first dungeon</UButton>
    </UCard>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <UCard
        v-for="dungeon in (dungeons as CampaignDungeonSummary[])"
        :key="dungeon.id"
        :ui="{ body: 'p-5' }"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold">{{ dungeon.name }}</h3>
              <p class="text-xs text-muted">{{ dungeon.theme }} • seed: {{ dungeon.seed }}</p>
            </div>
            <UBadge :label="dungeon.status" variant="subtle" color="neutral" />
          </div>

          <div class="text-xs text-muted">
            Rooms: {{ dungeon.roomCount }} • Updated {{ new Date(dungeon.updatedAt).toLocaleString() }}
          </div>

          <UButton
            variant="outline"
            :to="`/campaigns/${campaignId}/dungeons/${dungeon.id}`"
            icon="i-lucide-arrow-right"
          >
            Open dungeon
          </UButton>
        </div>
      </UCard>
    </div>

    <UModal v-model:open="isCreateOpen" title="Create dungeon">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Name" required>
            <UInput v-model="form.name" placeholder="Ancient catacombs" />
          </UFormField>
          <UFormField label="Theme" required>
            <UInput v-model="form.theme" placeholder="ruins" />
          </UFormField>
          <UFormField label="Seed (optional)">
            <UInput v-model="form.seed" placeholder="leave blank for auto-seed" />
          </UFormField>
          <p v-if="createError" class="text-sm text-error">{{ createError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="isCreateOpen = false">Cancel</UButton>
          <UButton :loading="isCreating" :disabled="!form.name.trim()" @click="createDungeon">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isImportOpen" title="Import dungeon JSON">
      <template #body>
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
          <p v-if="importError" class="text-sm text-error">{{ importError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="isImportOpen = false">Cancel</UButton>
          <UButton :loading="isImporting" :disabled="!importForm.payload.trim()" @click="importDungeon">
            Import
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
