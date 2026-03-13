<script setup lang="ts">
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
import { useCampaignCalendar } from '~/composables/useCampaignCalendar'

definePageMeta({ layout: 'dashboard' })

type QuestType = 'CAMPAIGN' | 'GUILD' | 'CHARACTER'
type QuestTrack = 'MAIN' | 'SIDE'
type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
type QuestSourceType = 'FREE_TEXT' | 'NPC' | 'CAMPAIGN_CHARACTER'

type QuestItem = {
  id: string
  campaignId: string
  title: string
  description?: string | null
  type: QuestType
  track: QuestTrack
  sourceType: QuestSourceType
  sourceText?: string | null
  sourceNpcId?: string | null
  sourceNpcName?: string | null
  sourceCharacterId?: string | null
  sourceCharacterName?: string | null
  reward?: string | null
  status: QuestStatus
  progressNotes?: string | null
  expirationDate?: {
    year: number
    month: number
    day: number
  } | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type GlossaryNpcItem = {
  id: string
  name: string
}

type CampaignCharacterLink = {
  character: {
    id: string
    name: string
  }
}

const { campaignId, request, canWriteContent } = useCampaignPageContext()
const calendarApi = useCampaignCalendar()

const { data: quests, pending, refresh, error } = await useAsyncData(
  () => `quests-${campaignId.value}`,
  () => request<QuestItem[]>(`/api/campaigns/${campaignId.value}/quests`)
)

const { data: npcEntries } = await useAsyncData(
  () => `quest-source-npcs-${campaignId.value}`,
  () => request<GlossaryNpcItem[]>(`/api/campaigns/${campaignId.value}/glossary`, { query: { type: 'NPC' } }),
)

const { data: characterLinks } = await useAsyncData(
  () => `quest-source-characters-${campaignId.value}`,
  () => request<CampaignCharacterLink[]>(`/api/campaigns/${campaignId.value}/characters`),
)

const { data: calendarConfig } = await useAsyncData(
  () => `quest-calendar-config-${campaignId.value}`,
  () => calendarApi.getConfig(campaignId.value),
)

const isInitialQuestsLoadPending = computed(() => pending.value && !quests.value)
const isCalendarEnabled = computed(() => Boolean(calendarConfig.value?.isEnabled))

const statusOptions: Array<{ label: string; value: QuestStatus }> = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'On hold', value: 'ON_HOLD' },
]

const typeOptions: Array<{ label: string; value: QuestType }> = [
  { label: 'Campaign', value: 'CAMPAIGN' },
  { label: 'Guild', value: 'GUILD' },
  { label: 'Character', value: 'CHARACTER' },
]

const trackOptions: Array<{ label: string; value: QuestTrack }> = [
  { label: 'Main quest', value: 'MAIN' },
  { label: 'Side quest', value: 'SIDE' },
]

const sourceTypeOptionsByQuestType: Record<QuestType, Array<{ label: string; value: QuestSourceType }>> = {
  CAMPAIGN: [
    { label: 'Free text', value: 'FREE_TEXT' },
    { label: 'NPC', value: 'NPC' },
  ],
  GUILD: [
    { label: 'Free text', value: 'FREE_TEXT' },
  ],
  CHARACTER: [
    { label: 'Free text', value: 'FREE_TEXT' },
    { label: 'Campaign character', value: 'CAMPAIGN_CHARACTER' },
  ],
}

const statusFilterOptions = [
  { label: 'All statuses', value: 'ALL' },
  ...statusOptions,
]

const typeFilterOptions = [
  { label: 'All categories', value: 'ALL' },
  ...typeOptions,
]

const trackFilterOptions = [
  { label: 'Main and side', value: 'ALL' },
  ...trackOptions,
]

const selectedStatusFilter = ref<'ALL' | QuestStatus>('ALL')
const selectedTypeFilter = ref<'ALL' | QuestType>('ALL')
const selectedTrackFilter = ref<'ALL' | QuestTrack>('ALL')

const statusLabelMap: Record<QuestStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ON_HOLD: 'On hold',
}

const typeLabelMap: Record<QuestType, string> = {
  CAMPAIGN: 'Campaign',
  GUILD: 'Guild',
  CHARACTER: 'Character',
}

const trackLabelMap: Record<QuestTrack, string> = {
  MAIN: 'Main quest',
  SIDE: 'Side quest',
}

const typeBadgeColor = (type: QuestType) => {
  if (type === 'CAMPAIGN') return 'primary'
  if (type === 'CHARACTER') return 'warning'
  return 'secondary'
}

const trackBadgeColor = (track: QuestTrack) => (track === 'MAIN' ? 'success' : 'neutral')

const filteredQuests = computed(() => {
  const source = quests.value || []
  return source.filter((quest) => {
    const typeMatch = selectedTypeFilter.value === 'ALL' || quest.type === selectedTypeFilter.value
    const trackMatch = selectedTrackFilter.value === 'ALL' || quest.track === selectedTrackFilter.value
    const statusMatch =
      selectedStatusFilter.value === 'ALL' || quest.status === selectedStatusFilter.value

    return typeMatch && trackMatch && statusMatch
  })
})

const primaryQuests = computed(() =>
  filteredQuests.value.filter((quest) => quest.status === 'ACTIVE' || quest.status === 'ON_HOLD')
)

const closedQuests = computed(() =>
  filteredQuests.value.filter((quest) => quest.status === 'COMPLETED' || quest.status === 'FAILED')
)

const npcOptions = computed(() =>
  (npcEntries.value || []).map((npc) => ({
    label: npc.name,
    value: npc.id,
  }))
)

const monthOptions = computed(() =>
  (calendarConfig.value?.months || []).map((month, index) => ({
    label: `${index + 1}: ${month.name}`,
    value: index + 1,
  }))
)

const characterOptions = computed(() =>
  (characterLinks.value || []).map((link) => ({
    label: link.character.name,
    value: link.character.id,
  }))
)

const {
  isOpen: isEditOpen,
  mode: editMode,
  form: editForm,
  error: editError,
  isSaving,
  openCreate: openQuestCreate,
  openEdit: openQuestEdit,
  saveWith: saveQuestWith,
} = useCrudModal(() => ({
  id: '',
  title: '',
  description: '',
  type: 'CAMPAIGN' as QuestType,
  track: 'SIDE' as QuestTrack,
  sourceType: 'FREE_TEXT' as QuestSourceType,
  sourceText: '',
  sourceNpcId: '',
  sourceCharacterId: '',
  reward: '',
  status: 'ACTIVE' as QuestStatus,
  progressNotes: '',
  expirationEnabled: false,
  expirationYear: 1,
  expirationMonth: 1,
  expirationDay: 1,
}))

const deletingQuestId = ref<string | null>(null)

const availableSourceOptions = computed(() => sourceTypeOptionsByQuestType[editForm.type])
const selectedExpirationMonthLength = computed(() => {
  const month = calendarConfig.value?.months?.[Math.max(0, editForm.expirationMonth - 1)]
  return month?.length || 1
})

const ensureValidSourceSelection = () => {
  const allowed = availableSourceOptions.value.map((option) => option.value)
  if (!allowed.includes(editForm.sourceType)) {
    editForm.sourceType = allowed[0] || 'FREE_TEXT'
  }

  if (editForm.sourceType !== 'FREE_TEXT') {
    editForm.sourceText = ''
  }
  if (editForm.sourceType !== 'NPC') {
    editForm.sourceNpcId = ''
  }
  if (editForm.sourceType !== 'CAMPAIGN_CHARACTER') {
    editForm.sourceCharacterId = ''
  }
}

watch(() => editForm.type, ensureValidSourceSelection)
watch(() => editForm.sourceType, ensureValidSourceSelection)
watch(
  () => editForm.expirationMonth,
  () => {
    if (editForm.expirationDay > selectedExpirationMonthLength.value) {
      editForm.expirationDay = selectedExpirationMonthLength.value
    }
  },
)

const openCreate = () => {
  if (!canWriteContent.value) return

  const currentDate = calendarConfig.value
    ? {
        year: calendarConfig.value.currentYear,
        month: calendarConfig.value.currentMonth,
        day: calendarConfig.value.currentDay,
      }
    : {
        year: 1,
        month: 1,
        day: 1,
      }

  openQuestCreate({
    type: 'CAMPAIGN',
    track: 'SIDE',
    sourceType: 'FREE_TEXT',
    expirationEnabled: false,
    expirationYear: currentDate.year,
    expirationMonth: currentDate.month,
    expirationDay: currentDate.day,
  })
}

const openEdit = (quest: QuestItem) => {
  if (!canWriteContent.value) return

  openQuestEdit({
    id: quest.id,
    title: quest.title,
    description: quest.description || '',
    type: quest.type,
    track: quest.track,
    sourceType: quest.sourceType,
    sourceText: quest.sourceText || '',
    sourceNpcId: quest.sourceNpcId || '',
    sourceCharacterId: quest.sourceCharacterId || '',
    reward: quest.reward || '',
    status: quest.status,
    progressNotes: quest.progressNotes || '',
    expirationEnabled: Boolean(quest.expirationDate),
    expirationYear: quest.expirationDate?.year || calendarConfig.value?.currentYear || 1,
    expirationMonth: quest.expirationDate?.month || calendarConfig.value?.currentMonth || 1,
    expirationDay: quest.expirationDate?.day || calendarConfig.value?.currentDay || 1,
  })
}

const sourceLabelMap: Record<QuestSourceType, string> = {
  FREE_TEXT: 'Free text',
  NPC: 'NPC',
  CAMPAIGN_CHARACTER: 'Campaign character',
}

const getSourceLabel = (quest: Pick<QuestItem, 'sourceType' | 'sourceText' | 'sourceNpcName' | 'sourceCharacterName'>) => {
  if (quest.sourceType === 'FREE_TEXT') {
    return quest.sourceText || 'Free text'
  }
  if (quest.sourceType === 'NPC') {
    return quest.sourceNpcName || 'NPC'
  }
  if (quest.sourceType === 'CAMPAIGN_CHARACTER') {
    return quest.sourceCharacterName || 'Campaign character'
  }
  return sourceLabelMap[quest.sourceType]
}

const getExpirationLabel = (quest: Pick<QuestItem, 'expirationDate'>) => {
  if (!quest.expirationDate) return null

  const monthName = calendarConfig.value?.months?.[quest.expirationDate.month - 1]?.name
  if (monthName) {
    return `${monthName} ${quest.expirationDate.day}, Year ${quest.expirationDate.year}`
  }

  return `${quest.expirationDate.year}-${quest.expirationDate.month}-${quest.expirationDate.day}`
}

const saveQuest = async () => {
  if (!canWriteContent.value) return

  await saveQuestWith(async ({ mode, form }) => {
    const body = {
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      track: form.track,
      sourceType: form.sourceType,
      sourceText: form.sourceType === 'FREE_TEXT' ? form.sourceText || undefined : undefined,
      sourceNpcId: form.sourceType === 'NPC' ? form.sourceNpcId || undefined : undefined,
      sourceCharacterId: form.sourceType === 'CAMPAIGN_CHARACTER' ? form.sourceCharacterId || undefined : undefined,
      reward: form.reward || undefined,
      status: form.status,
      progressNotes: form.progressNotes || undefined,
      expirationDate: form.expirationEnabled
        ? {
            year: form.expirationYear,
            month: form.expirationMonth,
            day: form.expirationDay,
          }
        : undefined,
    }

    if (mode === 'create') {
      await request(`/api/campaigns/${campaignId.value}/quests`, {
        method: 'POST',
        body,
      })
    }
    else {
      await request(`/api/quests/${form.id}`, {
        method: 'PATCH',
        body: {
          ...body,
          description: form.description || null,
          sourceText: form.sourceType === 'FREE_TEXT' ? form.sourceText || null : null,
          sourceNpcId: form.sourceType === 'NPC' ? form.sourceNpcId || null : null,
          sourceCharacterId: form.sourceType === 'CAMPAIGN_CHARACTER' ? form.sourceCharacterId || null : null,
          reward: form.reward || null,
          progressNotes: form.progressNotes || null,
          expirationDate: form.expirationEnabled
            ? {
                year: form.expirationYear,
                month: form.expirationMonth,
                day: form.expirationDay,
              }
            : null,
        },
      })
    }

    await refresh()
  }, 'Unable to save quest.')
}

const deleteQuest = async (quest: QuestItem) => {
  if (!canWriteContent.value) return
  deletingQuestId.value = quest.id
  try {
    await request(`/api/quests/${quest.id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingQuestId.value = null
  }
}

const deleteEditingQuest = async () => {
  if (editMode.value !== 'edit') return
  const quest = (quests.value || []).find((item) => item.id === editForm.id)
  if (!quest) return

  await deleteQuest(quest)
  isEditOpen.value = false
}

const updateStatus = async (quest: QuestItem, status: QuestStatus) => {
  if (!canWriteContent.value) return
  await request(`/api/quests/${quest.id}`, {
    method: 'PATCH',
    body: { status },
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <CampaignListTemplate
      headline="Quests"
      title="Quest tracker"
      description="Track quest category, main or side status, rewards, sources, and expiration dates."
      action-label="New quest"
      action-icon="i-lucide-plus"
      :action-disabled="!canWriteContent"
      @action="openCreate"
    >
      <template #notice>
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can view quests but cannot change them."
        />
      </template>

      <template #filters>
        <UCard>
          <div class="grid gap-4 md:grid-cols-3">
            <UFormField label="Filter by category" name="typeFilter">
              <USelect v-model="selectedTypeFilter" :items="typeFilterOptions" />
            </UFormField>
            <UFormField label="Filter by track" name="trackFilter">
              <USelect v-model="selectedTrackFilter" :items="trackFilterOptions" />
            </UFormField>
            <UFormField label="Filter by status" name="statusFilter">
              <USelect v-model="selectedStatusFilter" :items="statusFilterOptions" />
            </UFormField>
          </div>
        </UCard>
      </template>

      <SharedResourceState
        :pending="isInitialQuestsLoadPending"
        :error="error"
        :empty="!quests?.length"
        error-message="Unable to load quests."
        empty-message="No quests yet."
        @retry="refresh"
      >
        <template #loading>
          <div class="grid gap-4 sm:grid-cols-2">
            <UCard v-for="i in 3" :key="i" class="h-32 animate-pulse" />
          </div>
        </template>
        <template #emptyActions>
          <UButton variant="outline" :disabled="!canWriteContent" @click="openCreate">Create your first quest</UButton>
        </template>

        <div v-if="quests?.length" class="space-y-6">
          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold">Active and on hold quests</h2>
              <span class="text-xs text-muted">{{ primaryQuests.length }} shown</span>
            </div>
            <div v-if="primaryQuests.length" class="grid gap-4 sm:grid-cols-2">
              <CampaignQuestCard
                v-for="quest in primaryQuests"
                :key="quest.id"
                :quest="quest"
                :can-write-content="canWriteContent"
                :status-options="statusOptions"
                :status-label-map="statusLabelMap"
                :type-label-map="typeLabelMap"
                :track-label-map="trackLabelMap"
                :type-badge-color="typeBadgeColor"
                :track-badge-color="trackBadgeColor"
                :get-source-label="getSourceLabel"
                :get-expiration-label="getExpirationLabel"
                @edit="(quest) => openEdit(quest as QuestItem)"
                @update-status="(quest, status) => updateStatus(quest as QuestItem, status as QuestStatus)"
              />
            </div>
            <UCard v-else>
              <p class="text-sm text-muted">No active or on-hold quests match the current filters.</p>
            </UCard>
          </section>

          <section class="space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold">Completed and failed quests</h2>
              <span class="text-xs text-muted">{{ closedQuests.length }} shown</span>
            </div>
            <div v-if="closedQuests.length" class="grid gap-4 sm:grid-cols-2">
              <CampaignQuestCard
                v-for="quest in closedQuests"
                :key="quest.id"
                :quest="quest"
                :can-write-content="canWriteContent"
                :status-options="statusOptions"
                :status-label-map="statusLabelMap"
                :type-label-map="typeLabelMap"
                :track-label-map="trackLabelMap"
                :type-badge-color="typeBadgeColor"
                :track-badge-color="trackBadgeColor"
                :get-source-label="getSourceLabel"
                :get-expiration-label="getExpirationLabel"
                @edit="(quest) => openEdit(quest as QuestItem)"
                @update-status="(quest, status) => updateStatus(quest as QuestItem, status as QuestStatus)"
              />
            </div>
            <UCard v-else>
              <p class="text-sm text-muted">No completed or failed quests match the current filters.</p>
            </UCard>
          </section>
        </div>
      </SharedResourceState>
    </CampaignListTemplate>

    <SharedEntityFormModal
      v-model:open="isEditOpen"
      :title="editMode === 'create' ? 'Create quest' : 'Edit quest'"
      :saving="isSaving"
      :error="editError"
      :submit-label="editMode === 'create' ? 'Create' : 'Save'"
      :show-delete-action="editMode === 'edit'"
      :delete-loading="deletingQuestId === editForm.id"
      @delete="deleteEditingQuest"
      @submit="saveQuest"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="editForm.title" />
      </UFormField>

      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Quest category" name="type">
          <USelect v-model="editForm.type" class="w-full" :items="typeOptions" />
        </UFormField>
        <UFormField label="Quest track" name="track">
          <USelect v-model="editForm.track" class="w-full" :items="trackOptions" />
        </UFormField>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <UFormField label="Source type" name="sourceType">
          <USelect v-model="editForm.sourceType" class="w-full" :items="availableSourceOptions" />
        </UFormField>
        <UFormField label="Status" name="status">
          <USelect v-model="editForm.status" class="w-full" :items="statusOptions" />
        </UFormField>
      </div>

      <UFormField v-if="editForm.sourceType === 'FREE_TEXT'" label="Source" name="sourceText">
        <UInput v-model="editForm.sourceText" placeholder="Who or what issued this quest?" />
      </UFormField>

        <UFormField v-if="editForm.sourceType === 'NPC'" label="NPC source" name="sourceNpcId">
          <USelect
            v-model="editForm.sourceNpcId"
            class="w-full"
            :items="npcOptions"
            placeholder="Select an NPC"
          />
        </UFormField>

      <UFormField
        v-if="editForm.sourceType === 'CAMPAIGN_CHARACTER'"
        label="Campaign character source"
        name="sourceCharacterId"
      >
        <USelect
          v-model="editForm.sourceCharacterId"
          class="w-full"
          :items="characterOptions"
          placeholder="Select a campaign character"
        />
      </UFormField>

      <UFormField label="Description" name="description">
        <UTextarea v-model="editForm.description" :rows="4" />
      </UFormField>

      <UFormField label="Reward" name="reward">
        <UTextarea v-model="editForm.reward" :rows="2" />
      </UFormField>

      <UFormField label="Progress notes" name="progressNotes">
        <UTextarea v-model="editForm.progressNotes" :rows="3" />
      </UFormField>

      <div class="space-y-3 rounded-lg border border-default bg-accented/30 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium">Expiration date</p>
            <p class="text-xs text-muted">Uses the campaign calendar when enabled.</p>
          </div>
          <USwitch
            :model-value="editForm.expirationEnabled"
            :disabled="!isCalendarEnabled"
            @update:model-value="(value) => editForm.expirationEnabled = value"
          />
        </div>

        <p v-if="!isCalendarEnabled" class="text-xs text-muted">
          Enable the campaign calendar from Settings to set expiration dates.
        </p>

        <div v-else-if="editForm.expirationEnabled" class="grid gap-4 md:grid-cols-3">
          <UFormField label="Year" name="expirationYear">
            <UInput v-model.number="editForm.expirationYear" type="number" />
          </UFormField>
          <UFormField label="Month" name="expirationMonth">
            <USelect v-model="editForm.expirationMonth" class="w-full" :items="monthOptions" />
          </UFormField>
          <UFormField label="Day" name="expirationDay">
            <UInput
              v-model.number="editForm.expirationDay"
              type="number"
              min="1"
              :max="selectedExpirationMonthLength"
            />
          </UFormField>
        </div>
      </div>
    </SharedEntityFormModal>
  </div>
</template>
