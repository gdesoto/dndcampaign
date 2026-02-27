<script setup lang="ts">
import type { EncounterSummary } from '#shared/types/encounter'
import type { EncounterCreateInput } from '#shared/schemas/encounter'
import type { CampaignCalendarConfigDto } from '~/composables/useCampaignCalendar'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const { request } = useApi()

const encounterApi = useEncounterList()
const statBlockApi = useEncounterStatBlocks()
const templateApi = useEncounterTemplates()

const filters = reactive<{
  status: 'ALL' | 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  type: 'ALL' | 'COMBAT' | 'SOCIAL' | 'SKILL_CHALLENGE' | 'CHASE' | 'HAZARD'
}>({
  status: 'ALL',
  type: 'ALL',
})

const {
  data: encounters,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `encounters-${campaignId.value}-${filters.status}-${filters.type}`,
  () =>
    encounterApi.listEncounters(campaignId.value, {
      status: filters.status === 'ALL' ? undefined : filters.status,
      type: filters.type === 'ALL' ? undefined : filters.type,
    }),
  {
    watch: [() => filters.status, () => filters.type],
  },
)
const {
  data: statBlocks,
  pending: statBlocksPending,
  error: statBlocksError,
  refresh: refreshStatBlocks,
} = await useAsyncData(
  () => `encounter-stat-blocks-${campaignId.value}`,
  () => statBlockApi.listStatBlocks(campaignId.value),
)
const {
  data: templates,
  pending: templatesPending,
  error: templatesError,
  refresh: refreshTemplates,
} = await useAsyncData(
  () => `encounter-templates-${campaignId.value}`,
  () => templateApi.listTemplates(campaignId.value),
)

const isCreateOpen = ref(false)
const createError = ref('')
const isCreating = ref(false)
const statBlockError = ref('')
const isStatBlockModalOpen = ref(false)
const isSavingStatBlock = ref(false)
const editingStatBlockId = ref<string | null>(null)
const templateError = ref('')
const isTemplateModalOpen = ref(false)
const isSavingTemplate = ref(false)
const editingTemplateId = ref<string | null>(null)
const statBlockForm = reactive<{
  name: string
  challengeRating: string
  maxHp: number | null
  armorClass: number | null
  speed: number | null
  notes: string
}>({
  name: '',
  challengeRating: '',
  maxHp: null,
  armorClass: null,
  speed: null,
  notes: '',
})
const templateForm = reactive<{
  name: string
  type: 'COMBAT' | 'SOCIAL' | 'SKILL_CHALLENGE' | 'CHASE' | 'HAZARD'
  notes: string
  combatants: Array<{
    name: string
    side: 'ALLY' | 'ENEMY' | 'NEUTRAL'
    sourceType: 'CAMPAIGN_CHARACTER' | 'PLAYER_CHARACTER' | 'GLOSSARY_ENTRY' | 'CUSTOM'
    sourceStatBlockId: string
    quantity: number
    maxHp: number | null
    armorClass: number | null
    speed: number | null
    notes: string
  }>
}>({
  name: '',
  type: 'COMBAT',
  notes: '',
  combatants: [],
})
type CampaignSessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
}
const { data: campaignSessions } = await useAsyncData(
  () => `encounter-create-sessions-${campaignId.value}`,
  () => request<CampaignSessionOption[]>(`/api/campaigns/${campaignId.value}/sessions`),
)
const { data: calendarConfig } = await useAsyncData(
  () => `encounter-create-calendar-config-${campaignId.value}`,
  () => request<CampaignCalendarConfigDto | null>(`/api/campaigns/${campaignId.value}/calendar-config`),
)

const sessionOptions = computed(() =>
  (campaignSessions.value || []).map((session) => ({
    value: session.id,
    label: session.sessionNumber ? `Session ${session.sessionNumber}: ${session.title}` : session.title,
  })),
)

const openCreate = () => {
  if (!canWriteContent.value) return
  createError.value = ''
  isCreateOpen.value = true
}

const resetStatBlockForm = () => {
  editingStatBlockId.value = null
  statBlockError.value = ''
  statBlockForm.name = ''
  statBlockForm.challengeRating = ''
  statBlockForm.maxHp = null
  statBlockForm.armorClass = null
  statBlockForm.speed = null
  statBlockForm.notes = ''
}

const openCreateStatBlock = () => {
  if (!canWriteContent.value) return
  resetStatBlockForm()
  isStatBlockModalOpen.value = true
}

const resetTemplateForm = () => {
  editingTemplateId.value = null
  templateError.value = ''
  templateForm.name = ''
  templateForm.type = 'COMBAT'
  templateForm.notes = ''
  templateForm.combatants = []
}

const addTemplateCombatantRow = () => {
  templateForm.combatants.push({
    name: '',
    side: 'ENEMY',
    sourceType: 'CUSTOM',
    sourceStatBlockId: '',
    quantity: 1,
    maxHp: null,
    armorClass: null,
    speed: null,
    notes: '',
  })
}

const removeTemplateCombatantRow = (index: number) => {
  templateForm.combatants.splice(index, 1)
}

const openCreateTemplate = () => {
  if (!canWriteContent.value) return
  resetTemplateForm()
  addTemplateCombatantRow()
  isTemplateModalOpen.value = true
}

const openEditTemplate = (templateId: string) => {
  if (!canWriteContent.value) return
  const template = (templates.value || []).find((entry) => entry.id === templateId)
  if (!template) return
  resetTemplateForm()
  editingTemplateId.value = template.id
  templateForm.name = template.name
  templateForm.type = template.type
  templateForm.notes = template.notes || ''
  templateForm.combatants = template.combatants.map((combatant) => ({
    name: combatant.name,
    side: combatant.side,
    sourceType: combatant.sourceType,
    sourceStatBlockId: combatant.sourceStatBlockId || '',
    quantity: combatant.quantity,
    maxHp: combatant.maxHp ?? null,
    armorClass: combatant.armorClass ?? null,
    speed: combatant.speed ?? null,
    notes: combatant.notes || '',
  }))
  if (!templateForm.combatants.length) addTemplateCombatantRow()
  isTemplateModalOpen.value = true
}

const openEditStatBlock = (id: string) => {
  if (!canWriteContent.value) return
  const statBlock = (statBlocks.value || []).find((entry) => entry.id === id)
  if (!statBlock) return
  resetStatBlockForm()
  editingStatBlockId.value = statBlock.id
  statBlockForm.name = statBlock.name
  statBlockForm.challengeRating = statBlock.challengeRating || ''
  statBlockForm.notes = statBlock.notes || ''
  const statBlockJson = statBlock.statBlockJson || {}
  const asFiniteInt = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
  statBlockForm.maxHp = asFiniteInt(statBlockJson.maxHp)
  statBlockForm.armorClass = asFiniteInt(statBlockJson.armorClass)
  statBlockForm.speed = asFiniteInt(statBlockJson.speed)
  isStatBlockModalOpen.value = true
}

const saveStatBlock = async () => {
  if (!canWriteContent.value) return
  isSavingStatBlock.value = true
  statBlockError.value = ''
  const toOptionalInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
  const payload = {
    name: statBlockForm.name,
    challengeRating: statBlockForm.challengeRating || undefined,
    notes: statBlockForm.notes || undefined,
    statBlockJson: {
      maxHp: toOptionalInt(statBlockForm.maxHp),
      armorClass: toOptionalInt(statBlockForm.armorClass),
      speed: toOptionalInt(statBlockForm.speed),
    },
  }

  try {
    if (editingStatBlockId.value) {
      await statBlockApi.updateStatBlock(editingStatBlockId.value, payload)
    } else {
      await statBlockApi.createStatBlock(campaignId.value, payload)
    }
    isStatBlockModalOpen.value = false
    await refreshStatBlocks()
  } catch (error) {
    statBlockError.value = (error as Error).message || 'Unable to save stat block.'
  } finally {
    isSavingStatBlock.value = false
  }
}

const deleteStatBlock = async (id: string) => {
  if (!canWriteContent.value) return
  statBlockError.value = ''
  try {
    await statBlockApi.deleteStatBlock(id)
    await refreshStatBlocks()
  } catch (error) {
    statBlockError.value = (error as Error).message || 'Unable to delete stat block.'
  }
}

const saveTemplate = async () => {
  if (!canWriteContent.value) return
  isSavingTemplate.value = true
  templateError.value = ''
  const toOptionalInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
  const normalizedCombatants = templateForm.combatants
    .map((combatant, index) => ({
      name: combatant.name.trim(),
      side: combatant.side,
      sourceType: combatant.sourceType,
      sourceStatBlockId: combatant.sourceStatBlockId || undefined,
      quantity: Math.max(1, Math.trunc(combatant.quantity || 1)),
      maxHp: toOptionalInt(combatant.maxHp),
      armorClass: toOptionalInt(combatant.armorClass),
      speed: toOptionalInt(combatant.speed),
      sortOrder: index,
      notes: combatant.notes || undefined,
    }))
    .filter((combatant) => combatant.name.length > 0)
  const payload = {
    name: templateForm.name,
    type: templateForm.type,
    notes: templateForm.notes || undefined,
    combatants: normalizedCombatants,
  }

  try {
    if (editingTemplateId.value) {
      await templateApi.updateTemplate(editingTemplateId.value, payload)
    } else {
      await templateApi.createTemplate(campaignId.value, payload)
    }
    isTemplateModalOpen.value = false
    await refreshTemplates()
  } catch (error) {
    templateError.value = (error as Error).message || 'Unable to save template.'
  } finally {
    isSavingTemplate.value = false
  }
}

const deleteTemplate = async (templateId: string) => {
  if (!canWriteContent.value) return
  templateError.value = ''
  try {
    await templateApi.deleteTemplate(templateId)
    await refreshTemplates()
  } catch (error) {
    templateError.value = (error as Error).message || 'Unable to delete template.'
  }
}

const createEncounter = async (payload: EncounterCreateInput) => {
  if (!canWriteContent.value) return

  isCreating.value = true
  createError.value = ''
  try {
    const created = await encounterApi.createEncounter(campaignId.value, payload)
    if (!created) throw new Error('Encounter could not be created.')
    isCreateOpen.value = false
    await refresh()
    await navigateTo(`/campaigns/${campaignId.value}/encounters/${created.id}`)
  } catch (error) {
    createError.value = (error as Error).message || 'Unable to create encounter.'
  } finally {
    isCreating.value = false
  }
}

const statusColor = (status: EncounterSummary['status']) => {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAUSED') return 'warning'
  if (status === 'COMPLETED') return 'neutral'
  if (status === 'ABANDONED') return 'error'
  return 'secondary'
}

const encounterTypeOptions = [
  { label: 'Combat', value: 'COMBAT' },
  { label: 'Social', value: 'SOCIAL' },
  { label: 'Skill challenge', value: 'SKILL_CHALLENGE' },
  { label: 'Chase', value: 'CHASE' },
  { label: 'Hazard', value: 'HAZARD' },
]
const combatantSideOptions = [
  { label: 'Enemy', value: 'ENEMY' },
  { label: 'Ally', value: 'ALLY' },
  { label: 'Neutral', value: 'NEUTRAL' },
]
const combatantSourceTypeOptions = [
  { label: 'Custom', value: 'CUSTOM' },
  { label: 'Glossary Entry', value: 'GLOSSARY_ENTRY' },
  { label: 'Campaign Character', value: 'CAMPAIGN_CHARACTER' },
  { label: 'Player Character', value: 'PLAYER_CHARACTER' },
]
const statBlockOptions = computed(() =>
  (statBlocks.value || []).map((statBlock) => ({
    label: statBlock.name,
    value: statBlock.id,
  })),
)
</script>

<template>
  <CampaignListTemplate
    headline="Campaign Tool"
    title="Encounter tracker"
    description="Track, run, and reuse encounter setups."
    action-label="New encounter"
    :action-disabled="!canWriteContent"
    @action="openCreate"
  >
    <template #notice>
      <UAlert
        v-if="!canWriteContent"
        color="warning"
        variant="subtle"
        title="Read-only access"
        description="Your role can view encounter data but cannot create or edit encounters."
      />
    </template>

    <template #filters>
      <EncounterListFilters
        :status="filters.status"
        :type="filters.type"
        @update:status="filters.status = $event"
        @update:type="filters.type = $event"
      />
    </template>

    <SharedResourceState
      :pending="pending"
      :error="error"
      :empty="!encounters?.length"
      error-message="Unable to load encounters."
      empty-message="No encounters yet."
      @retry="refresh"
    >
      <template #loading>
        <div class="grid gap-3 md:grid-cols-2">
          <UCard v-for="index in 4" :key="index" class="h-24 animate-pulse" />
        </div>
      </template>

      <div class="grid gap-3 md:grid-cols-2">
        <NuxtLink v-for="encounter in encounters || []" :key="encounter.id" :to="`/campaigns/${campaignId}/encounters/${encounter.id}`">
          <SharedListItemCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-lg font-semibold">{{ encounter.name }}</h3>
                <UBadge :color="statusColor(encounter.status)" variant="soft">{{ encounter.status }}</UBadge>
              </div>
            </template>
            <p class="text-sm text-muted">{{ encounter.type }} · Round {{ encounter.currentRound }}</p>
          </SharedListItemCard>
        </NuxtLink>
      </div>
    </SharedResourceState>

    <EncounterCreateEncounterModal
      v-model:open="isCreateOpen"
      :saving="isCreating"
      :error="createError"
      :session-options="sessionOptions"
      :calendar-enabled="Boolean(calendarConfig?.isEnabled)"
      @create="createEncounter"
    />

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold">Stat block library</h2>
            <p class="text-sm text-muted">Reusable campaign-local NPC and monster definitions.</p>
          </div>
          <UButton :disabled="!canWriteContent" variant="outline" @click="openCreateStatBlock">New stat block</UButton>
        </div>
      </template>
      <SharedResourceState
        :pending="statBlocksPending"
        :error="statBlocksError"
        :empty="!statBlocks?.length"
        error-message="Unable to load encounter stat blocks."
        empty-message="No stat blocks yet."
        @retry="refreshStatBlocks"
      >
        <div class="space-y-2">
          <div
            v-for="statBlock in statBlocks || []"
            :key="statBlock.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/70 p-3"
          >
            <div>
              <p class="font-medium">{{ statBlock.name }}</p>
              <p class="text-xs text-muted">
                CR {{ statBlock.challengeRating || '?' }}
                · HP {{ statBlock.statBlockJson.maxHp ?? '?' }}
                · AC {{ statBlock.statBlockJson.armorClass ?? '?' }}
                · SPD {{ statBlock.statBlockJson.speed ?? '?' }}
              </p>
            </div>
            <div class="flex gap-2">
              <UButton :disabled="!canWriteContent" size="xs" variant="outline" @click="openEditStatBlock(statBlock.id)">Edit</UButton>
              <SharedConfirmActionPopover
                message="Delete this stat block?"
                content-class="w-72 p-3"
                confirm-label="Delete"
                confirm-icon="i-lucide-trash-2"
                @confirm="({ close }) => { deleteStatBlock(statBlock.id); close() }"
              >
                <template #trigger>
                  <UButton :disabled="!canWriteContent" size="xs" color="error" variant="ghost">Delete</UButton>
                </template>
                <template #content>
                  <p class="text-sm text-muted">Remove {{ statBlock.name }} from the campaign stat block library?</p>
                </template>
              </SharedConfirmActionPopover>
            </div>
          </div>
        </div>
      </SharedResourceState>
      <p v-if="statBlockError" class="mt-3 text-sm text-error">{{ statBlockError }}</p>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold">Encounter template library</h2>
            <p class="text-sm text-muted">Save reusable encounter setups with participant rows.</p>
          </div>
          <UButton :disabled="!canWriteContent" variant="outline" @click="openCreateTemplate">New template</UButton>
        </div>
      </template>
      <SharedResourceState
        :pending="templatesPending"
        :error="templatesError"
        :empty="!templates?.length"
        error-message="Unable to load encounter templates."
        empty-message="No encounter templates yet."
        @retry="refreshTemplates"
      >
        <div class="space-y-2">
          <div
            v-for="template in templates || []"
            :key="template.id"
            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default/70 p-3"
          >
            <div>
              <p class="font-medium">{{ template.name }}</p>
              <p class="text-xs text-muted">{{ template.type }} · {{ template.combatants.length }} row(s)</p>
            </div>
            <div class="flex gap-2">
              <UButton :disabled="!canWriteContent" size="xs" variant="outline" @click="openEditTemplate(template.id)">Edit</UButton>
              <SharedConfirmActionPopover
                message="Delete this template?"
                content-class="w-72 p-3"
                confirm-label="Delete"
                confirm-icon="i-lucide-trash-2"
                @confirm="({ close }) => { deleteTemplate(template.id); close() }"
              >
                <template #trigger>
                  <UButton :disabled="!canWriteContent" size="xs" color="error" variant="ghost">Delete</UButton>
                </template>
                <template #content>
                  <p class="text-sm text-muted">Remove {{ template.name }} from the encounter template library?</p>
                </template>
              </SharedConfirmActionPopover>
            </div>
          </div>
        </div>
      </SharedResourceState>
      <p v-if="templateError" class="mt-3 text-sm text-error">{{ templateError }}</p>
    </UCard>

    <SharedEntityFormModal
      v-model:open="isStatBlockModalOpen"
      :title="editingStatBlockId ? 'Edit stat block' : 'Create stat block'"
      submit-label="Save"
      :saving="isSavingStatBlock"
      :error="statBlockError"
      @submit="saveStatBlock"
    >
      <UFormField label="Name">
        <UInput v-model="statBlockForm.name" placeholder="Goblin skirmisher" />
      </UFormField>
      <UFormField label="Challenge rating">
        <UInput v-model="statBlockForm.challengeRating" placeholder="1/4" />
      </UFormField>
      <div class="grid gap-3 sm:grid-cols-3">
        <UFormField label="Max HP">
          <UInput v-model.number="statBlockForm.maxHp" type="number" />
        </UFormField>
        <UFormField label="Armor Class">
          <UInput v-model.number="statBlockForm.armorClass" type="number" />
        </UFormField>
        <UFormField label="Speed">
          <UInput v-model.number="statBlockForm.speed" type="number" />
        </UFormField>
      </div>
      <UFormField label="Notes">
        <UTextarea v-model="statBlockForm.notes" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>

    <SharedEntityFormModal
      v-model:open="isTemplateModalOpen"
      :title="editingTemplateId ? 'Edit template' : 'Create template'"
      submit-label="Save"
      :saving="isSavingTemplate"
      :error="templateError"
      @submit="saveTemplate"
    >
      <UFormField label="Name">
        <UInput v-model="templateForm.name" placeholder="Bandit roadside ambush" />
      </UFormField>
      <UFormField label="Type">
        <USelect v-model="templateForm.type" :items="encounterTypeOptions" />
      </UFormField>
      <UFormField label="Notes">
        <UTextarea v-model="templateForm.notes" :rows="2" />
      </UFormField>

      <UCard :ui="{ body: 'space-y-3 p-3' }">
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm font-medium">Template combatants</p>
          <UButton size="xs" variant="outline" @click="addTemplateCombatantRow">Add row</UButton>
        </div>
        <div
          v-for="(combatant, index) in templateForm.combatants"
          :key="`template-combatant-${index}`"
          class="space-y-2 rounded-md border border-default/70 p-3"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Row {{ index + 1 }}</p>
            <UButton size="xs" color="error" variant="ghost" @click="removeTemplateCombatantRow(index)">Remove</UButton>
          </div>
          <UFormField label="Name">
            <UInput v-model="combatant.name" placeholder="Bandit" />
          </UFormField>
          <div class="grid gap-2 sm:grid-cols-3">
            <UFormField label="Side">
              <USelect v-model="combatant.side" :items="combatantSideOptions" />
            </UFormField>
            <UFormField label="Source type">
              <USelect v-model="combatant.sourceType" :items="combatantSourceTypeOptions" />
            </UFormField>
            <UFormField label="Quantity">
              <UInput v-model.number="combatant.quantity" type="number" min="1" />
            </UFormField>
          </div>
          <UFormField label="Stat block">
            <USelect v-model="combatant.sourceStatBlockId" :items="statBlockOptions" placeholder="Optional" />
          </UFormField>
          <div class="grid gap-2 sm:grid-cols-3">
            <UFormField label="Max HP">
              <UInput v-model.number="combatant.maxHp" type="number" />
            </UFormField>
            <UFormField label="Armor Class">
              <UInput v-model.number="combatant.armorClass" type="number" />
            </UFormField>
            <UFormField label="Speed">
              <UInput v-model.number="combatant.speed" type="number" />
            </UFormField>
          </div>
          <UFormField label="Notes">
            <UInput v-model="combatant.notes" placeholder="Optional row notes" />
          </UFormField>
        </div>
      </UCard>
    </SharedEntityFormModal>
  </CampaignListTemplate>
</template>

