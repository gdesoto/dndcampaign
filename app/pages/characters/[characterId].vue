<script setup lang="ts">
import type { CharacterImportPayload, CharacterImportRefreshPayload } from '~/utils/character-import'
import { getCharacterImportErrorMessage } from '~/utils/character-import'

definePageMeta({ layout: 'app' })

type CampaignOption = { id: string; name: string }
type CampaignLink = {
  id: string
  campaignId: string
  characterId: string
  status: 'ACTIVE' | 'INACTIVE'
  roleLabel?: string | null
  notes?: string | null
  campaign: { id: string; name: string }
  accessImpact?: {
    warningRequired: boolean
    impactedUserCount: number
  }
}

type Character = {
  id: string
  name: string
  canEdit: boolean
  isOwner: boolean
  status?: string | null
  portraitUrl?: string | null
  sheetJson?: Record<string, unknown>
  summaryJson?: Record<string, unknown>
  campaignLinks: CampaignLink[]
}

const route = useRoute()
const router = useRouter()
const characterId = computed(() => route.params.characterId as string)
const { request } = useApi()

const { data: character, pending, refresh, error } = await useAsyncData(
  () => `character-${characterId.value}`,
  () => request<Character>(`/api/characters/${characterId.value}`)
)

const { data: campaigns } = await useAsyncData('characters-campaigns', () =>
  request<CampaignOption[]>('/api/campaigns')
)

const sheet = computed(() => (character.value?.sheetJson as Record<string, unknown>) || {})
const canEdit = computed(() => Boolean(character.value?.canEdit))

const activeSection = ref('BASICS')
const sectionTabs = [
  { label: 'Basics', value: 'BASICS' },
  { label: 'Ability Scores', value: 'ABILITY_SCORES' },
  { label: 'Background', value: 'BACKGROUND' },
  { label: 'Classes', value: 'CLASSES' },
  { label: 'Spells', value: 'SPELLS' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Notes', value: 'NOTES' },
  { label: 'Raw', value: 'CUSTOM' },
]

const basicsForm = reactive({
  name: '',
  playerName: '',
  level: 1,
  alignment: '',
  experience: 0,
  inspiration: false,
})

const abilityForm = reactive({
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
})

const backgroundForm = reactive({
  name: '',
  traits: '',
  ideals: '',
  bonds: '',
  flaws: '',
})

const notesForm = reactive({
  backstory: '',
  other: '',
})

const classesJson = ref('')
const spellsJson = ref('')
const equipmentJson = ref('')
const rawJson = ref('')

const syncFormState = () => {
  const basics = (sheet.value.basics as Record<string, unknown> | undefined) || {}
  basicsForm.name = (basics.name as string) || character.value?.name || ''
  basicsForm.playerName = (basics.playerName as string) || ''
  basicsForm.level = (basics.level as number) || 1
  basicsForm.alignment = (basics.alignment as string) || ''
  basicsForm.experience = (basics.experience as number) || 0
  basicsForm.inspiration = Boolean(basics.inspiration)

  const abilityScores = (sheet.value.abilityScores as Record<string, unknown> | undefined) || {}
  abilityForm.str = (abilityScores.str as number) || 10
  abilityForm.dex = (abilityScores.dex as number) || 10
  abilityForm.con = (abilityScores.con as number) || 10
  abilityForm.int = (abilityScores.int as number) || 10
  abilityForm.wis = (abilityScores.wis as number) || 10
  abilityForm.cha = (abilityScores.cha as number) || 10

  const background = (sheet.value.background as Record<string, unknown> | undefined) || {}
  backgroundForm.name = (background.name as string) || ''
  backgroundForm.traits = Array.isArray(background.traits)
    ? (background.traits as string[]).join('\n')
    : ''
  backgroundForm.ideals = Array.isArray(background.ideals)
    ? (background.ideals as string[]).join('\n')
    : ''
  backgroundForm.bonds = Array.isArray(background.bonds)
    ? (background.bonds as string[]).join('\n')
    : ''
  backgroundForm.flaws = Array.isArray(background.flaws)
    ? (background.flaws as string[]).join('\n')
    : ''

  const notes = (sheet.value.notes as Record<string, unknown> | undefined) || {}
  notesForm.backstory = (notes.backstory as string) || ''
  notesForm.other = (notes.other as string) || ''

  classesJson.value = JSON.stringify(sheet.value.classes || [], null, 2)
  spellsJson.value = JSON.stringify(sheet.value.spells || {}, null, 2)
  equipmentJson.value = JSON.stringify(sheet.value.equipment || [], null, 2)
  rawJson.value = JSON.stringify(sheet.value.custom || {}, null, 2)
}

watch(
  () => character.value,
  () => {
    if (character.value) syncFormState()
  },
  { immediate: true }
)

const savingSection = ref('')
const sectionError = ref('')

const saveSection = async (section: string, payload: unknown) => {
  if (!canEdit.value) return
  sectionError.value = ''
  savingSection.value = section
  try {
    await request(`/api/characters/${characterId.value}`, {
      method: 'PATCH',
      body: { section, payload },
    })
    await refresh()
  } catch (error) {
    sectionError.value =
      (error as Error & { message?: string }).message || 'Unable to save section.'
  } finally {
    savingSection.value = ''
  }
}

const saveBasics = async () => {
  if (!canEdit.value) return
  await request(`/api/characters/${characterId.value}`, {
    method: 'PATCH',
    body: {
      name: basicsForm.name,
      status: character.value?.status || undefined,
    },
  })
  await saveSection('BASICS', {
    name: basicsForm.name,
    playerName: basicsForm.playerName,
    level: basicsForm.level,
    alignment: basicsForm.alignment,
    experience: basicsForm.experience,
    inspiration: basicsForm.inspiration,
  })
}

const parseJson = (value: string, fallback: unknown) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const saveClasses = async () => saveSection('CLASSES', parseJson(classesJson.value, []))
const saveSpells = async () => saveSection('SPELLS', parseJson(spellsJson.value, {}))
const saveEquipment = async () => saveSection('EQUIPMENT', parseJson(equipmentJson.value, []))
const saveRaw = async () => saveSection('CUSTOM', parseJson(rawJson.value, {}))

const isImportOpen = ref(false)
const importError = ref('')
const isImporting = ref(false)

const openImport = () => {
  if (!canEdit.value) return
  importError.value = ''
  isImportOpen.value = true
}

const importCharacter = async (payload: CharacterImportPayload) => {
  if (!canEdit.value) return
  importError.value = ''
  isImporting.value = true
  try {
    await request(`/api/characters/${characterId.value}/import`, {
      method: 'POST',
      body: payload,
    })
    isImportOpen.value = false
    await refresh()
  } catch (error) {
    importError.value = getCharacterImportErrorMessage(error, 'Unable to import character.')
  } finally {
    isImporting.value = false
  }
}

const refreshImport = async (payload: CharacterImportRefreshPayload) => {
  if (!canEdit.value) return
  importError.value = ''
  isImporting.value = true
  try {
    await request(`/api/characters/${characterId.value}/import/refresh`, {
      method: 'POST',
      body: payload,
    })
    await refresh()
  } catch (error) {
    importError.value = getCharacterImportErrorMessage(error, 'Unable to refresh import.')
  } finally {
    isImporting.value = false
  }
}

const statusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
]

const attachCampaignId = ref('')
const attachToCampaign = async () => {
  if (!canEdit.value) return
  if (!attachCampaignId.value) return
  await request(`/api/campaigns/${attachCampaignId.value}/characters`, {
    method: 'POST',
    body: { characterId: characterId.value },
  })
  attachCampaignId.value = ''
  await refresh()
}

const updateCampaignLink = async (link: CampaignLink, status: CampaignLink['status']) => {
  if (!canEdit.value) return
  await request(`/api/campaigns/${link.campaignId}/characters/${link.characterId}`, {
    method: 'PATCH',
    body: { status },
  })
  await refresh()
}

const removeFromCampaign = async (link: CampaignLink) => {
  if (!canEdit.value) return
  await request(`/api/campaigns/${link.campaignId}/characters/${link.characterId}`, {
    method: 'DELETE',
  })
  await refresh()
}

const removeFromCampaignWithClose = async (link: CampaignLink, close: () => void) => {
  await removeFromCampaign(link)
  close()
}

const deleteCharacter = async () => {
  if (!canEdit.value) return
  await request(`/api/characters/${characterId.value}`, { method: 'DELETE' })
  router.push('/characters')
}
</script>

<template>
  <UPage>
    <div class="space-y-6">
    <UCard v-if="pending" class="h-32 animate-pulse" />
    <UCard v-else-if="error" class="text-center">
      <p class="text-sm text-error">Unable to load character.</p>
      <UButton class="mt-4" variant="outline" @click="() => refresh()">Try again</UButton>
    </UCard>

    <div v-else-if="character" class="space-y-6">
      <UAlert
        v-if="!canEdit"
        color="warning"
        variant="subtle"
        title="Read-only access"
        description="This character is shared through campaign membership. Only the character owner can edit or delete it."
      />
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Character</p>
              <h1 class="mt-2 text-2xl font-semibold">{{ character.name }}</h1>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton variant="outline" :disabled="!canEdit" @click="openImport">Import</UButton>
              <UButton color="error" variant="ghost" :disabled="!canEdit" @click="deleteCharacter">Delete</UButton>
            </div>
          </div>
        </template>
      </UCard>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Character sheet</h2>
              <UTabs v-model="activeSection" :items="sectionTabs" />
            </div>
          </template>

          <div v-if="activeSection === 'BASICS'" class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Name</label>
              <UInput v-model="basicsForm.name" :disabled="!canEdit" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Player name</label>
              <UInput v-model="basicsForm.playerName" :disabled="!canEdit" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Level</label>
                <UInput v-model.number="basicsForm.level" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Experience</label>
                <UInput v-model.number="basicsForm.experience" type="number" min="0" :disabled="!canEdit" />
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Alignment</label>
              <UInput v-model="basicsForm.alignment" :disabled="!canEdit" />
            </div>
            <div class="flex items-center gap-3">
              <USwitch v-model="basicsForm.inspiration" :disabled="!canEdit" />
              <span class="text-sm text-muted">Inspiration</span>
            </div>
            <UButton :loading="savingSection === 'BASICS'" :disabled="!canEdit" @click="saveBasics">Save basics</UButton>
          </div>

          <div v-else-if="activeSection === 'ABILITY_SCORES'" class="space-y-4">
            <div class="grid gap-4 md:grid-cols-3">
              <div>
                <label class="mb-2 block text-sm text-muted">STR</label>
                <UInput v-model.number="abilityForm.str" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">DEX</label>
                <UInput v-model.number="abilityForm.dex" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">CON</label>
                <UInput v-model.number="abilityForm.con" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">INT</label>
                <UInput v-model.number="abilityForm.int" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">WIS</label>
                <UInput v-model.number="abilityForm.wis" type="number" min="1" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">CHA</label>
                <UInput v-model.number="abilityForm.cha" type="number" min="1" :disabled="!canEdit" />
              </div>
            </div>
            <UButton
              :loading="savingSection === 'ABILITY_SCORES'"
              :disabled="!canEdit"
              @click="saveSection('ABILITY_SCORES', { ...abilityForm })"
            >
              Save ability scores
            </UButton>
          </div>

          <div v-else-if="activeSection === 'BACKGROUND'" class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Background name</label>
              <UInput v-model="backgroundForm.name" :disabled="!canEdit" />
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm text-muted">Traits</label>
                <UTextarea v-model="backgroundForm.traits" :rows="4" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Ideals</label>
                <UTextarea v-model="backgroundForm.ideals" :rows="4" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Bonds</label>
                <UTextarea v-model="backgroundForm.bonds" :rows="4" :disabled="!canEdit" />
              </div>
              <div>
                <label class="mb-2 block text-sm text-muted">Flaws</label>
                <UTextarea v-model="backgroundForm.flaws" :rows="4" :disabled="!canEdit" />
              </div>
            </div>
            <UButton
              :loading="savingSection === 'BACKGROUND'"
              :disabled="!canEdit"
              @click="
                saveSection('BACKGROUND', {
                  name: backgroundForm.name,
                  traits: backgroundForm.traits.split('\n').filter(Boolean),
                  ideals: backgroundForm.ideals.split('\n').filter(Boolean),
                  bonds: backgroundForm.bonds.split('\n').filter(Boolean),
                  flaws: backgroundForm.flaws.split('\n').filter(Boolean),
                })
              "
            >
              Save background
            </UButton>
          </div>

          <div v-else-if="activeSection === 'CLASSES'" class="space-y-4">
            <UTextarea v-model="classesJson" :rows="10" :disabled="!canEdit" />
            <UButton :loading="savingSection === 'CLASSES'" :disabled="!canEdit" @click="saveClasses">Save classes</UButton>
          </div>

          <div v-else-if="activeSection === 'SPELLS'" class="space-y-4">
            <UTextarea v-model="spellsJson" :rows="10" :disabled="!canEdit" />
            <UButton :loading="savingSection === 'SPELLS'" :disabled="!canEdit" @click="saveSpells">Save spells</UButton>
          </div>

          <div v-else-if="activeSection === 'EQUIPMENT'" class="space-y-4">
            <UTextarea v-model="equipmentJson" :rows="10" :disabled="!canEdit" />
            <UButton :loading="savingSection === 'EQUIPMENT'" :disabled="!canEdit" @click="saveEquipment">Save equipment</UButton>
          </div>

          <div v-else-if="activeSection === 'NOTES'" class="space-y-4">
            <div>
              <label class="mb-2 block text-sm text-muted">Backstory</label>
              <UTextarea v-model="notesForm.backstory" :rows="6" :disabled="!canEdit" />
            </div>
            <div>
              <label class="mb-2 block text-sm text-muted">Other notes</label>
              <UTextarea v-model="notesForm.other" :rows="4" :disabled="!canEdit" />
            </div>
            <UButton
              :loading="savingSection === 'NOTES'"
              :disabled="!canEdit"
              @click="saveSection('NOTES', { backstory: notesForm.backstory, other: notesForm.other })"
            >
              Save notes
            </UButton>
          </div>

          <div v-else class="space-y-4">
            <UTextarea v-model="rawJson" :rows="12" :disabled="!canEdit" />
            <UButton :loading="savingSection === 'CUSTOM'" :disabled="!canEdit" @click="saveRaw">Save raw data</UButton>
          </div>

          <p v-if="sectionError" class="text-sm text-error">{{ sectionError }}</p>
        </UCard>

        <div class="space-y-4">
          <UCard>
            <template #header>
              <div>
                <h3 class="text-sm font-semibold">Campaign links</h3>
                <p class="text-xs text-muted">Manage campaign membership.</p>
              </div>
            </template>
            <div class="space-y-3">
              <div v-if="character.campaignLinks?.length" class="space-y-2 text-sm">
                <div
                  v-for="link in character.campaignLinks"
                  :key="link.id"
                  class="space-y-2 rounded-lg border border-default bg-elevated/30 px-3 py-2.5"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="min-w-0 truncate font-semibold">{{ link.campaign.name }}</p>
                    <UTooltip text="Open campaign" :content="{ side: 'left' }">
                      <UButton
                        :to="`/campaigns/${link.campaignId}`"
                        size="xs"
                        variant="ghost"
                        icon="i-lucide-square-arrow-out-up-right"
                        aria-label="Open campaign"
                      />
                    </UTooltip>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                    <USelect
                      :items="statusOptions"
                      :model-value="link.status"
                      size="xs"
                      class="w-full max-w-36"
                      :disabled="!canEdit"
                      @update:model-value="(value) => updateCampaignLink(link, value as CampaignLink['status'])"
                    />
                    <UPopover :content="{ side: 'left', align: 'end' }" :ui="{ content: 'w-64 p-3' }">
                      <UTooltip text="Remove link" :content="{ side: 'left' }">
                        <UButton
                          size="xs"
                          variant="ghost"
                          color="error"
                          icon="i-lucide-trash-2"
                          :disabled="!canEdit"
                          aria-label="Remove campaign link"
                        />
                      </UTooltip>
                      <template #content="{ close }">
                        <div class="space-y-3">
                          <p class="text-sm text-muted">
                            Remove {{ character?.name || 'this character' }} from
                            "{{ link.campaign.name }}"?
                          </p>
                          <UAlert
                            v-if="link.accessImpact?.warningRequired"
                            color="warning"
                            variant="subtle"
                            title="Shared access warning"
                            :description="`Up to ${link.accessImpact.impactedUserCount} non-owner member(s) may lose access after removal.`"
                          />
                          <div class="flex justify-end gap-2">
                            <UButton size="xs" variant="ghost" color="neutral" @click="close">
                              Cancel
                            </UButton>
                            <UButton
                              size="xs"
                              color="error"
                              icon="i-lucide-trash-2"
                              :disabled="!canEdit"
                              @click="removeFromCampaignWithClose(link, close)"
                            >
                              Remove
                            </UButton>
                          </div>
                        </div>
                      </template>
                    </UPopover>
                  </div>
                </div>
              </div>
              <p v-else class="text-xs text-muted">Not linked to any campaigns yet.</p>
              <div class="flex flex-col gap-2 sm:flex-row">
                <USelectMenu
                  v-model="attachCampaignId"
                  value-key="id"
                  label-key="name"
                  :items="campaigns || []"
                  placeholder="Attach to campaign"
                  :disabled="!canEdit"
                  class="flex-1"
                />
                <UButton :disabled="!canEdit || !attachCampaignId" class="w-full sm:w-auto" @click="attachToCampaign">
                  Attach
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    </div>

    <CharactersImportModal
      v-model:open="isImportOpen"
      :loading="isImporting"
      :error="importError"
      default-mode="SECTIONS"
      :show-refresh-button="true"
      @submit="importCharacter"
      @refresh="refreshImport"
    />
  </UPage>
</template>


