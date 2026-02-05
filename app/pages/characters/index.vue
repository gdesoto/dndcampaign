<script setup lang="ts">
definePageMeta({ layout: 'app' })

type Character = {
  id: string
  name: string
  status?: string | null
  summaryJson?: {
    level?: number
    classes?: string[]
    race?: string
    background?: string
    alignment?: string
    portraitUrl?: string
  }
  updatedAt: string
}

const { request } = useApi()
const router = useRouter()

const { data: characters, pending, refresh, error } = await useAsyncData(
  'characters',
  () => request<Character[]>('/api/characters')
)

const isCreateOpen = ref(false)
const createError = ref('')
const isCreating = ref(false)
const createForm = reactive({
  name: '',
})

const openCreate = () => {
  createError.value = ''
  createForm.name = ''
  isCreateOpen.value = true
}

const createCharacter = async () => {
  createError.value = ''
  isCreating.value = true
  try {
    const character = await request<Character>('/api/characters', {
      method: 'POST',
      body: { name: createForm.name },
    })
    isCreateOpen.value = false
    await refresh()
    router.push(`/characters/${character.id}`)
  } catch (error) {
    createError.value =
      (error as Error & { message?: string }).message || 'Unable to create character.'
  } finally {
    isCreating.value = false
  }
}

const isImportOpen = ref(false)
const importError = ref('')
const isImporting = ref(false)
const sectionItems = [
  { label: 'Basics', value: 'BASICS' },
  { label: 'Ability Scores', value: 'ABILITY_SCORES' },
  { label: 'Saves', value: 'SAVES' },
  { label: 'Skills', value: 'SKILLS' },
  { label: 'Classes', value: 'CLASSES' },
  { label: 'Race', value: 'RACE' },
  { label: 'Background', value: 'BACKGROUND' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Currency', value: 'CURRENCY' },
  { label: 'Spells', value: 'SPELLS' },
  { label: 'Features', value: 'FEATURES' },
  { label: 'Proficiencies', value: 'PROFICIENCIES' },
  { label: 'Languages', value: 'LANGUAGES' },
  { label: 'Traits', value: 'TRAITS' },
  { label: 'Inventory', value: 'INVENTORY' },
  { label: 'Resources', value: 'RESOURCES' },
  { label: 'Hit Points', value: 'HIT_POINTS' },
  { label: 'Defenses', value: 'DEFENSES' },
  { label: 'Conditions', value: 'CONDITIONS' },
  { label: 'Attacks', value: 'ATTACKS' },
  { label: 'Notes', value: 'NOTES' },
  { label: 'Appearance', value: 'APPEARANCE' },
  { label: 'Portrait', value: 'PORTRAIT' },
  { label: 'Allies', value: 'ALLIES' },
  { label: 'Organizations', value: 'ORGANIZATIONS' },
  { label: 'Companions', value: 'COMPANIONS' },
  { label: 'Custom', value: 'CUSTOM' },
]

const importForm = reactive({
  externalId: '',
  overwriteMode: 'SECTIONS',
  sections: sectionItems.map((item) => item.value),
})

const openImport = () => {
  importError.value = ''
  importForm.externalId = ''
  importForm.overwriteMode = 'SECTIONS'
  importForm.sections = sectionItems.map((item) => item.value)
  isImportOpen.value = true
}

const importCharacter = async () => {
  importError.value = ''
  isImporting.value = true
  try {
    const character = await request<Character>('/api/characters/import', {
      method: 'POST',
      body: {
        provider: 'DND_BEYOND',
        externalId: importForm.externalId,
        overwriteMode: importForm.overwriteMode,
        sections: importForm.sections,
      },
    })
    isImportOpen.value = false
    await refresh()
    router.push(`/characters/${character.id}`)
  } catch (error) {
    importError.value =
      (error as Error & { message?: string }).message || 'Unable to import character.'
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <UPage>
    <div class="space-y-6">
      <UCard v-if="!pending">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Characters</p>
              <h1 class="mt-2 text-2xl font-semibold">Player Character Roster</h1>
              <p class="mt-2 text-sm text-muted">Manage PCs shared across campaigns.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton variant="outline" @click="openImport">Import from D&amp;D Beyond</UButton>
              <UButton @click="openCreate">New character</UButton>
            </div>
          </div>
        </template>
      </UCard>

      <div v-if="pending" class="grid gap-4 sm:grid-cols-2">
        <UCard v-for="i in 4" :key="i" class="h-32 animate-pulse" />
      </div>

      <UCard v-else-if="error" class="text-center">
        <p class="text-sm text-error">Unable to load characters.</p>
        <UButton class="mt-4" variant="outline" @click="refresh">Try again</UButton>
      </UCard>

      <UCard v-else-if="!characters?.length" class="text-center">
        <p class="text-sm text-muted">No characters yet.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <UButton variant="outline" @click="openImport">Import from D&amp;D Beyond</UButton>
          <UButton @click="openCreate">Create your first character</UButton>
        </div>
      </UCard>

      <div v-else class="grid gap-4 md:grid-cols-2">
        <UCard v-for="character in characters" :key="character.id">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-dimmed">PC</p>
                <h3 class="text-lg font-semibold">{{ character.name }}</h3>
                <p v-if="character.status" class="text-xs text-muted">{{ character.status }}</p>
              </div>
              <UButton size="xs" variant="outline" :to="`/characters/${character.id}`">Open</UButton>
            </div>
          </template>
          <div class="space-y-2 text-sm">
            <p v-if="character.summaryJson?.classes?.length">
              Class: {{ character.summaryJson.classes.join(', ') }}
            </p>
            <p v-if="character.summaryJson?.level">Level: {{ character.summaryJson.level }}</p>
            <p v-if="character.summaryJson?.race">Race: {{ character.summaryJson.race }}</p>
            <p v-if="character.summaryJson?.background">Background: {{ character.summaryJson.background }}</p>
            <p v-if="character.summaryJson?.alignment">Alignment: {{ character.summaryJson.alignment }}</p>
          </div>
          <template #footer>
            <p class="text-xs text-muted">
              Updated {{ new Date(character.updatedAt).toLocaleDateString() }}
            </p>
          </template>
        </UCard>
      </div>
    </div>

    <UModal
      v-model:open="isCreateOpen"
      title="Create character"
      description="Add a new player character to your roster."
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-muted">Name</label>
            <UInput v-model="createForm.name" placeholder="Character name" />
          </div>
          <p v-if="createError" class="text-sm text-error">{{ createError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" color="gray" @click="isCreateOpen = false">Cancel</UButton>
          <UButton :loading="isCreating" @click="createCharacter">Create</UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isImportOpen"
      title="Import from D&amp;D Beyond"
      description="Provide a character ID and choose which sections to overwrite."
    >
      <template #body>
        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-muted">Character ID</label>
            <UInput v-model="importForm.externalId" placeholder="e.g. 135280063" />
          </div>
          <div>
            <label class="mb-2 block text-sm text-muted">Overwrite mode</label>
            <USelect
              v-model="importForm.overwriteMode"
              :items="[
                { label: 'Section overwrite', value: 'SECTIONS' },
                { label: 'Full overwrite', value: 'FULL' },
              ]"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm text-muted">Sections to import</label>
            <UCheckboxGroup v-model="importForm.sections" :items="sectionItems" variant="list" />
          </div>
          <p v-if="importError" class="text-sm text-error">{{ importError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton variant="ghost" color="gray" @click="isImportOpen = false">Cancel</UButton>
          <UButton :loading="isImporting" @click="importCharacter">Import</UButton>
        </div>
      </template>
    </UModal>
  </UPage>
</template>
