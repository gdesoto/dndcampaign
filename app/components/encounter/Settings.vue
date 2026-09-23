<script setup lang="ts">
import type { EncounterDetail } from '#shared/types/encounter'
import type { CampaignCalendarConfigDto } from '~/composables/useCampaignCalendar'
const props = defineProps<{ encounter: EncounterDetail; canEdit: boolean; canWrite: boolean }>()
const emit = defineEmits<{ saved: [] }>()
const campaignId = computed(() => props.encounter.campaignId)
const encounter = computed(() => props.encounter)
const encounterId = computed(() => props.encounter.id)
const canWriteContent = computed(() => props.canEdit)
const { request } = useApi()
const detailApi = useEncounterDetail()
const actionError = ref('')
const busy = ref(false)
const withAction = async (action: () => Promise<unknown>) => {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await action()
    emit('saved')
  } catch (error) {
    actionError.value = (error as Error).message
  } finally {
    busy.value = false
  }
}
type CampaignSessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
}
const {
  data: campaignSessions,
  error: sessionsError,
  refresh: refreshSessions,
} = await useAsyncData(
  () => `encounter-detail-sessions-${campaignId.value}`,
  () => request<CampaignSessionOption[]>(`/api/campaigns/${campaignId.value}/sessions`),
)

type CampaignQuestItem = {
  id: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
}
const {
  data: campaignQuests,
  error: questsError,
  refresh: refreshCampaignQuests,
} = await useAsyncData(
  () => `encounter-detail-quests-${campaignId.value}`,
  () => request<CampaignQuestItem[]>(`/api/campaigns/${campaignId.value}/quests`),
)
type CampaignMilestoneItem = {
  id: string
  title: string
  isComplete: boolean
}
const {
  data: campaignMilestones,
  error: milestonesError,
  refresh: refreshCampaignMilestones,
} = await useAsyncData(
  () => `encounter-detail-milestones-${campaignId.value}`,
  () => request<CampaignMilestoneItem[]>(`/api/campaigns/${campaignId.value}/milestones`),
)
const {
  data: calendarConfig,
  error: calendarError,
  refresh: refreshCalendar,
} = await useAsyncData(
  () => `encounter-detail-calendar-config-${campaignId.value}`,
  () =>
    request<CampaignCalendarConfigDto | null>(`/api/campaigns/${campaignId.value}/calendar/config`),
)

const sourceError = computed(
  () => sessionsError.value || questsError.value || milestonesError.value || calendarError.value,
)
const retrySources = () =>
  Promise.all([
    refreshSessions(),
    refreshCampaignQuests(),
    refreshCampaignMilestones(),
    refreshCalendar(),
  ])
const isSavingEncounterSettings = ref(false)
const isSavingSummaryShortcut = ref(false)
const selectedShortcutQuestId = ref('')
const selectedShortcutMilestoneId = ref('')
const encounterSettings = reactive<{
  sessionId: string
  calendarYear: number | null
  calendarMonth: number | null
  calendarDay: number | null
}>({
  sessionId: '',
  calendarYear: null,
  calendarMonth: null,
  calendarDay: null,
})

const saveEncounterSettings = async () => {
  if (!canWriteContent.value || !encounter.value || isSavingEncounterSettings.value) return
  const toNullableInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
  const calendarYear = toNullableInt(encounterSettings.calendarYear)
  const calendarMonth = toNullableInt(encounterSettings.calendarMonth)
  const calendarDay = toNullableInt(encounterSettings.calendarDay)
  const hasAnyDatePart = calendarYear !== null || calendarMonth !== null || calendarDay !== null
  const hasAllDateParts = calendarYear !== null && calendarMonth !== null && calendarDay !== null

  if (hasAnyDatePart && !hasAllDateParts) {
    actionError.value = 'Calendar year, month, and day must all be set, or all left blank.'
    return
  }

  const submitted = settingsDraft.snapshot()
  isSavingEncounterSettings.value = true
  await withAction(async () => {
    await detailApi.updateEncounter(encounterId.value, {
      sessionId: encounterSettings.sessionId || null,
      calendarYear: hasAllDateParts ? calendarYear : null,
      calendarMonth: hasAllDateParts ? calendarMonth : null,
      calendarDay: hasAllDateParts ? calendarDay : null,
    })
    settingsDraft.accept(submitted)
  })
  isSavingEncounterSettings.value = false
}

const markQuestCompleteFromSummary = async (questId: string = selectedShortcutQuestId.value) => {
  if (!props.canWrite || !questId || busy.value) return
  isSavingSummaryShortcut.value = true
  try {
    await withAction(async () => {
      await request(`/api/quests/${questId}`, {
        method: 'PATCH',
        body: { status: 'COMPLETED' },
      })
      await refreshCampaignQuests()
      selectedShortcutQuestId.value = ''
    })
  } finally {
    isSavingSummaryShortcut.value = false
  }
}

const markMilestoneCompleteFromSummary = async (
  milestoneId: string = selectedShortcutMilestoneId.value,
) => {
  if (!props.canWrite || !milestoneId || busy.value) return
  isSavingSummaryShortcut.value = true
  try {
    await withAction(async () => {
      await request(`/api/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: {
          isComplete: true,
          completedAt: new Date().toISOString(),
        },
      })
      await refreshCampaignMilestones()
      selectedShortcutMilestoneId.value = ''
    })
  } finally {
    isSavingSummaryShortcut.value = false
  }
}

const sessionOptions = computed(() =>
  (campaignSessions.value || []).map((session) => ({
    label: session.sessionNumber
      ? `Session ${session.sessionNumber}: ${session.title}`
      : session.title,
    value: session.id,
  })),
)

const activeQuestOptions = computed(() =>
  (campaignQuests.value || [])
    .filter((quest) => quest.status === 'ACTIVE' || quest.status === 'ON_HOLD')
    .map((quest) => ({ label: quest.title, value: quest.id })),
)
const openMilestoneOptions = computed(() =>
  (campaignMilestones.value || [])
    .filter((milestone) => !milestone.isComplete)
    .map((milestone) => ({ label: milestone.title, value: milestone.id })),
)

const settingsDraft = useEditorDraft(
  () => ({ ...encounterSettings }),
  (value) => Object.assign(encounterSettings, value),
)
useUnsavedChanges(settingsDraft.dirty, isSavingEncounterSettings)
watch(
  encounter,
  (value) => {
    if (!isSavingEncounterSettings.value)
      settingsDraft.sync(
        {
          sessionId: value.sessionId || '',
          calendarYear: value.calendarYear ?? null,
          calendarMonth: value.calendarMonth ?? null,
          calendarDay: value.calendarDay ?? null,
        },
        value.id,
      )
  },
  { immediate: true },
)
</script>
<template>
  <div class="space-y-4">
    <UAlert
      v-if="sourceError"
      color="error"
      description="Unable to load encounter settings options."
      :actions="[{ label: 'Retry', onClick: retrySources }]"
    />
    <UAlert v-if="actionError" color="error" :description="actionError" />
    <UCard>
      <template #header>
        <h2 class="type-section">Encounter settings</h2>
      </template>
      <div class="space-y-3">
        <UFormField label="Linked session">
          <USelect
            v-model="encounterSettings.sessionId"
            :disabled="!canEdit || busy || Boolean(sourceError)"
            :items="sessionOptions"
            placeholder="No linked session"
          />
        </UFormField>

        <UCard v-if="calendarConfig?.isEnabled" variant="soft" :ui="{ body: 'space-y-3 p-3' }">
          <p class="text-xs uppercase tracking-[0.08em] text-dimmed">Calendar link</p>
          <div class="grid gap-2 sm:grid-cols-3">
            <UFormField label="Year">
              <UInput
                v-model.number="encounterSettings.calendarYear"
                :disabled="!canEdit || busy"
                type="number"
              />
            </UFormField>
            <UFormField label="Month">
              <UInput
                v-model.number="encounterSettings.calendarMonth"
                :disabled="!canEdit || busy"
                type="number"
              />
            </UFormField>
            <UFormField label="Day">
              <UInput
                v-model.number="encounterSettings.calendarDay"
                :disabled="!canEdit || busy"
                type="number"
              />
            </UFormField>
          </div>
        </UCard>
        <UAlert
          v-else
          color="neutral"
          variant="soft"
          title="Calendar disabled"
          description="Enable campaign calendar to link encounter date."
        />

        <div class="flex justify-end">
          <UButton
            :disabled="!canEdit || busy || Boolean(sourceError)"
            :loading="isSavingEncounterSettings"
            @click="saveEncounterSettings"
          >
            Save settings
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="type-section">Quest & milestone shortcuts</h2>
      </template>
      <div class="space-y-3">
        <div class="flex flex-wrap gap-2">
          <UButton variant="outline" size="xs" :to="`/campaigns/${campaignId}/quests`"
            >Open quests</UButton
          >
          <UButton variant="outline" size="xs" :to="`/campaigns/${campaignId}/milestones`"
            >Open milestones</UButton
          >
        </div>

        <UFormField label="Mark quest complete">
          <div class="flex items-center gap-2">
            <USelect
              v-model="selectedShortcutQuestId"
              class="flex-1"
              :items="activeQuestOptions"
              placeholder="Select quest"
            />
            <UButton
              size="xs"
              :disabled="!canWrite || busy || !selectedShortcutQuestId"
              :loading="isSavingSummaryShortcut"
              @click="markQuestCompleteFromSummary()"
            >
              Complete
            </UButton>
          </div>
        </UFormField>

        <UFormField label="Mark milestone complete">
          <div class="flex items-center gap-2">
            <USelect
              v-model="selectedShortcutMilestoneId"
              class="flex-1"
              :items="openMilestoneOptions"
              placeholder="Select milestone"
            />
            <UButton
              size="xs"
              :disabled="!canWrite || busy || !selectedShortcutMilestoneId"
              :loading="isSavingSummaryShortcut"
              @click="markMilestoneCompleteFromSummary()"
            >
              Complete
            </UButton>
          </div>
        </UFormField>
      </div>
    </UCard>
  </div>
</template>
