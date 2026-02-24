<script setup lang="ts">
definePageMeta({ layout: 'default' })

import type { EncounterCombatant, EncounterDetail, EncounterSummaryReport } from '#shared/types/encounter'
import type { CampaignCalendarConfigDto } from '~/composables/useCampaignCalendar'

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const encounterId = computed(() => route.params.encounterId as string)

const canWriteContent = inject('campaignCanWriteContent', computed(() => true))
const { request } = useApi()

const detailApi = useEncounterDetail()
const runtimeApi = useEncounterRuntime()
const templateApi = useEncounterTemplates()
const statBlockApi = useEncounterStatBlocks()

const {
  data: encounter,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `encounter-${encounterId.value}`,
  () => detailApi.getEncounter(encounterId.value),
)

const { data: templates, refresh: refreshTemplates } = await useAsyncData(
  () => `encounter-templates-inline-${campaignId.value}`,
  () => templateApi.listTemplates(campaignId.value),
)
const { data: statBlocks } = await useAsyncData(
  () => `encounter-statblocks-inline-${campaignId.value}`,
  () => statBlockApi.listStatBlocks(campaignId.value),
)
type CampaignSessionOption = {
  id: string
  title: string
  sessionNumber?: number | null
}
const { data: campaignSessions } = await useAsyncData(
  () => `encounter-detail-sessions-${campaignId.value}`,
  () => request<CampaignSessionOption[]>(`/api/campaigns/${campaignId.value}/sessions`),
)
type CampaignCharacterLink = {
  id: string
  status: 'ACTIVE' | 'INACTIVE'
  character: {
    id: string
    name: string
    summaryJson?: Record<string, unknown>
  }
}
const { data: campaignCharacterLinks } = await useAsyncData(
  () => `encounter-detail-pcs-${campaignId.value}`,
  () => request<CampaignCharacterLink[]>(`/api/campaigns/${campaignId.value}/characters`),
)
type CampaignQuestItem = {
  id: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ON_HOLD'
}
const { data: campaignQuests, refresh: refreshCampaignQuests } = await useAsyncData(
  () => `encounter-detail-quests-${campaignId.value}`,
  () => request<CampaignQuestItem[]>(`/api/campaigns/${campaignId.value}/quests`),
)
type CampaignMilestoneItem = {
  id: string
  title: string
  isComplete: boolean
}
const { data: campaignMilestones, refresh: refreshCampaignMilestones } = await useAsyncData(
  () => `encounter-detail-milestones-${campaignId.value}`,
  () => request<CampaignMilestoneItem[]>(`/api/campaigns/${campaignId.value}/milestones`),
)
const { data: calendarConfig } = await useAsyncData(
  () => `encounter-detail-calendar-config-${campaignId.value}`,
  () => request<CampaignCalendarConfigDto | null>(`/api/campaigns/${campaignId.value}/calendar-config`),
)

const summary = ref<EncounterSummaryReport | null>(null)
const summaryPending = ref(false)
const actionError = ref('')
const noteDraft = ref('')
const initialLoading = computed(() => pending.value && !encounter.value)
const preferredActiveCombatantId = ref<string | null>(null)

const activeIndex = computed(() => encounter.value?.currentTurnIndex || 0)
const sortedCombatants = computed(() => {
  const list = encounter.value?.combatants || []
  return [...list].sort((left, right) => left.sortOrder - right.sortOrder)
})
const activeCombatant = computed(() => {
  const combatants = sortedCombatants.value
  const indexed = combatants[activeIndex.value]
  if (indexed) return indexed
  if (preferredActiveCombatantId.value) {
    return combatants.find((combatant) => combatant.id === preferredActiveCombatantId.value) || null
  }
  return combatants[0] || null
})
const activeConditions = computed(() => {
  if (!activeCombatant.value) return []
  return (encounter.value?.conditions || []).filter((condition) => condition.combatantId === activeCombatant.value?.id)
})

const hpModifier = ref(5)
const selectedCampaignCharacterIds = ref<string[]>([])
const isCombatantEditOpen = ref(false)
const isSavingCombatant = ref(false)
const isManageCombatantsOpen = ref(false)
const isSavingManageCombatants = ref(false)
const manageCombatantMode = ref<'pc' | 'statblock' | 'custom' | 'copy'>('pc')
const selectedStatBlockId = ref('')
const copySourceCombatantId = ref('')
const manageQuantity = ref(1)
const customCombatantForm = reactive<{
  name: string
  side: 'ALLY' | 'ENEMY' | 'NEUTRAL'
  maxHp: number | null
  armorClass: number | null
  speed: number | null
}>({
  name: '',
  side: 'ENEMY',
  maxHp: null,
  armorClass: null,
  speed: null,
})
const isConditionModalOpen = ref(false)
const isSavingCondition = ref(false)
const editingConditionId = ref<string | null>(null)
const conditionPreset = ref('CUSTOM')
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
const combatantForm = reactive<{
  id: string
  name: string
  side: 'ALLY' | 'ENEMY' | 'NEUTRAL'
  sourceType: 'CUSTOM' | 'CAMPAIGN_CHARACTER' | 'PLAYER_CHARACTER' | 'GLOSSARY_ENTRY'
  sourceStatBlockId: string
  maxHp: number | null
  currentHp: number | null
  tempHp: number
  armorClass: number | null
  speed: number | null
  notes: string
}>({
  id: '',
  name: '',
  side: 'ENEMY',
  sourceType: 'CUSTOM',
  sourceStatBlockId: '',
  maxHp: null,
  currentHp: null,
  tempHp: 0,
  armorClass: null,
  speed: null,
  notes: '',
})
const conditionForm = reactive<{
  name: string
  duration: number | null
  remaining: number | null
  tickTiming: 'TURN_START' | 'TURN_END' | 'ROUND_END'
  source: string
  notes: string
}>({
  name: '',
  duration: null,
  remaining: null,
  tickTiming: 'TURN_END',
  source: '',
  notes: '',
})

const withAction = async (action: () => Promise<unknown>) => {
  actionError.value = ''
  try {
    await action()
    await refreshPreservingUiState()
  } catch (error) {
    actionError.value = (error as Error).message || 'Action failed.'
  }
}

const refreshPreservingUiState = async () => {
  const previousActiveId = activeCombatant.value?.id || preferredActiveCombatantId.value
  const previousScrollY = process.client ? window.scrollY : 0

  await Promise.all([refresh(), refreshSummary()])
  await nextTick()

  if (process.client) {
    window.scrollTo({
      top: previousScrollY,
      behavior: 'auto',
    })
  }
  preferredActiveCombatantId.value = previousActiveId || null
}

const refreshSummary = async () => {
  summaryPending.value = true
  try {
    summary.value = (await detailApi.getSummary(encounterId.value)) as EncounterSummaryReport
  } catch {
    summary.value = null
  } finally {
    summaryPending.value = false
  }
}

const openManageCombatants = () => {
  if (!canWriteContent.value) return
  selectedCampaignCharacterIds.value = []
  selectedStatBlockId.value = ''
  copySourceCombatantId.value = ''
  manageQuantity.value = 1
  customCombatantForm.name = ''
  customCombatantForm.side = 'ENEMY'
  customCombatantForm.maxHp = null
  customCombatantForm.armorClass = null
  customCombatantForm.speed = null
  isManageCombatantsOpen.value = true
}

const saveManageCombatants = async () => {
  if (!canWriteContent.value) return
  isSavingManageCombatants.value = true
  const toOptionalInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
  try {
    await withAction(async () => {
      if (manageCombatantMode.value === 'pc') {
        if (!selectedCampaignCharacterIds.value.length) throw new Error('Select at least one campaign PC.')
        const selected = (campaignCharacterLinks.value || []).filter(
          (link) => selectedCampaignCharacterIds.value.includes(link.character.id),
        )
        for (const entry of selected) {
          await runtimeApi.createCombatant(encounterId.value, {
            name: entry.character.name,
            side: 'ALLY',
            sourceType: 'CAMPAIGN_CHARACTER',
            sourceCampaignCharacterId: entry.character.id,
            tempHp: 0,
            isHidden: false,
          })
        }
      } else if (manageCombatantMode.value === 'statblock') {
        const statBlock = (statBlocks.value || []).find((entry) => entry.id === selectedStatBlockId.value)
        if (!statBlock) throw new Error('Select a stat block first.')
        const count = Math.max(1, Math.trunc(manageQuantity.value || 1))
        const maxHp = typeof statBlock.statBlockJson.maxHp === 'number' ? Math.trunc(statBlock.statBlockJson.maxHp) : undefined
        const armorClass = typeof statBlock.statBlockJson.armorClass === 'number' ? Math.trunc(statBlock.statBlockJson.armorClass) : undefined
        const speed = typeof statBlock.statBlockJson.speed === 'number' ? Math.trunc(statBlock.statBlockJson.speed) : undefined
        for (let index = 0; index < count; index += 1) {
          await runtimeApi.createCombatant(encounterId.value, {
            name: count > 1 ? `${statBlock.name} ${index + 1}` : statBlock.name,
            side: 'ENEMY',
            sourceType: 'CUSTOM',
            sourceStatBlockId: statBlock.id,
            maxHp,
            currentHp: maxHp,
            armorClass,
            speed,
            tempHp: 0,
            isHidden: false,
          })
        }
      } else if (manageCombatantMode.value === 'copy') {
        const sourceCombatant = sortedCombatants.value.find((entry) => entry.id === copySourceCombatantId.value)
        if (!sourceCombatant) throw new Error('Select an existing combatant first.')
        const count = Math.max(1, Math.trunc(manageQuantity.value || 1))
        for (let index = 0; index < count; index += 1) {
          await runtimeApi.createCombatant(encounterId.value, {
            name: count > 1 ? `${sourceCombatant.name} Copy ${index + 1}` : `${sourceCombatant.name} Copy`,
            side: sourceCombatant.side,
            sourceType: sourceCombatant.sourceType,
            sourceCampaignCharacterId: sourceCombatant.sourceCampaignCharacterId || undefined,
            sourcePlayerCharacterId: sourceCombatant.sourcePlayerCharacterId || undefined,
            sourceGlossaryEntryId: sourceCombatant.sourceGlossaryEntryId || undefined,
            sourceStatBlockId: sourceCombatant.sourceStatBlockId || undefined,
            maxHp: sourceCombatant.maxHp || undefined,
            currentHp: sourceCombatant.currentHp || undefined,
            armorClass: sourceCombatant.armorClass || undefined,
            speed: sourceCombatant.speed || undefined,
            tempHp: sourceCombatant.tempHp,
            isHidden: sourceCombatant.isHidden,
            notes: sourceCombatant.notes || undefined,
          })
        }
      } else {
        if (!customCombatantForm.name.trim()) throw new Error('Custom combatant name is required.')
        await runtimeApi.createCombatant(encounterId.value, {
          name: customCombatantForm.name.trim(),
          side: customCombatantForm.side,
          sourceType: 'CUSTOM',
          maxHp: toOptionalInt(customCombatantForm.maxHp),
          currentHp: toOptionalInt(customCombatantForm.maxHp),
          armorClass: toOptionalInt(customCombatantForm.armorClass),
          speed: toOptionalInt(customCombatantForm.speed),
          tempHp: 0,
          isHidden: false,
        })
      }
      isManageCombatantsOpen.value = false
    })
  } finally {
    isSavingManageCombatants.value = false
  }
}

const openCombatantEditor = (combatant: EncounterCombatant) => {
  combatantForm.id = combatant.id
  combatantForm.name = combatant.name
  combatantForm.side = combatant.side
  combatantForm.sourceType = combatant.sourceType
  combatantForm.sourceStatBlockId = combatant.sourceStatBlockId || ''
  combatantForm.maxHp = combatant.maxHp ?? null
  combatantForm.currentHp = combatant.currentHp ?? null
  combatantForm.tempHp = combatant.tempHp
  combatantForm.armorClass = combatant.armorClass ?? null
  combatantForm.speed = combatant.speed ?? null
  combatantForm.notes = combatant.notes || ''
  isCombatantEditOpen.value = true
}

const saveCombatantEditor = async () => {
  if (!canWriteContent.value || !combatantForm.id) return
  isSavingCombatant.value = true
  const toNullableInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
  await withAction(async () => {
    await runtimeApi.updateCombatant(encounterId.value, combatantForm.id, {
      name: combatantForm.name,
      side: combatantForm.side,
      sourceType: combatantForm.sourceType,
      sourceStatBlockId:
        combatantForm.sourceType === 'CUSTOM' || !combatantForm.sourceStatBlockId
          ? undefined
          : combatantForm.sourceStatBlockId,
      maxHp: toNullableInt(combatantForm.maxHp),
      currentHp: toNullableInt(combatantForm.currentHp),
      tempHp: Math.max(0, toNullableInt(combatantForm.tempHp) ?? 0),
      armorClass: toNullableInt(combatantForm.armorClass),
      speed: toNullableInt(combatantForm.speed),
      notes: combatantForm.notes || undefined,
    })
    isCombatantEditOpen.value = false
  })
  isSavingCombatant.value = false
}

const deleteCombatant = async (combatantId: string) => {
  if (!canWriteContent.value) return
  await withAction(() => runtimeApi.deleteCombatant(encounterId.value, combatantId))
}

const runStatusAction = async (action: 'start' | 'pause' | 'resume' | 'complete' | 'abandon' | 'reset') => {
  if (!canWriteContent.value) return
  await withAction(async () => {
    if (action === 'start') await runtimeApi.start(encounterId.value)
    if (action === 'pause') await runtimeApi.pause(encounterId.value)
    if (action === 'resume') await runtimeApi.resume(encounterId.value)
    if (action === 'complete') await runtimeApi.complete(encounterId.value)
    if (action === 'abandon') await runtimeApi.abandon(encounterId.value)
    if (action === 'reset') await runtimeApi.reset(encounterId.value)
  })
}

const advanceTurn = async () => {
  if (!canWriteContent.value) return
  await withAction(() => runtimeApi.advanceTurn(encounterId.value))
}

const rewindTurn = async () => {
  if (!canWriteContent.value) return
  await withAction(() => runtimeApi.rewindTurn(encounterId.value))
}

const rollInitiative = async (mode: 'ALL' | 'UNSET' | 'NON_PCS' = 'ALL') => {
  if (!canWriteContent.value) return
  await withAction(() => runtimeApi.rollInitiative(encounterId.value, { mode }))
}

const moveInitiativeItem = async (payload: { combatantId: string, direction: 'up' | 'down' }) => {
  if (!canWriteContent.value) return
  const currentIds = sortedCombatants.value.map((combatant) => combatant.id)
  const fromIndex = currentIds.findIndex((id) => id === payload.combatantId)
  if (fromIndex < 0) return
  const toIndex = payload.direction === 'up' ? fromIndex - 1 : fromIndex + 1
  if (toIndex < 0 || toIndex >= currentIds.length) return
  const nextIds = [...currentIds]
  const [item] = nextIds.splice(fromIndex, 1)
  if (!item) return
  nextIds.splice(toIndex, 0, item)
  await withAction(() => runtimeApi.reorderInitiative(encounterId.value, { combatantOrder: nextIds }))
}

const setManualInitiative = async (payload: { combatantId: string, initiative: number | null }) => {
  if (!canWriteContent.value) return
  await withAction(() =>
    runtimeApi.updateCombatant(encounterId.value, payload.combatantId, {
      initiative: payload.initiative,
    }),
  )
}

const toggleCampaignPcSelection = (characterId: string, checked: boolean) => {
  if (checked) {
    if (!selectedCampaignCharacterIds.value.includes(characterId)) {
      selectedCampaignCharacterIds.value.push(characterId)
    }
    return
  }
  selectedCampaignCharacterIds.value = selectedCampaignCharacterIds.value.filter((id) => id !== characterId)
}

const setActive = async (combatantId: string) => {
  if (!canWriteContent.value) return
  preferredActiveCombatantId.value = combatantId
  await withAction(() => runtimeApi.setActiveTurn(encounterId.value, { combatantId }))
}

const quickApplyDamage = async () => {
  if (!canWriteContent.value || !activeCombatant.value) return
  const amount = Math.max(1, Math.trunc(hpModifier.value || 0))
  await withAction(() => runtimeApi.applyDamage(encounterId.value, activeCombatant.value!.id, amount))
}

const quickApplyHeal = async () => {
  if (!canWriteContent.value || !activeCombatant.value) return
  const amount = Math.max(1, Math.trunc(hpModifier.value || 0))
  await withAction(() => runtimeApi.applyHeal(encounterId.value, activeCombatant.value!.id, amount))
}

const addNote = async () => {
  if (!canWriteContent.value || !noteDraft.value.trim()) return
  await withAction(async () => {
    await detailApi.addNoteEvent(encounterId.value, noteDraft.value.trim())
    noteDraft.value = ''
  })
}

const resetConditionForm = () => {
  editingConditionId.value = null
  conditionForm.name = ''
  conditionForm.duration = null
  conditionForm.remaining = null
  conditionForm.tickTiming = 'TURN_END'
  conditionForm.source = ''
  conditionForm.notes = ''
}

const openCreateCondition = () => {
  if (!canWriteContent.value || !activeCombatant.value) return
  resetConditionForm()
  conditionPreset.value = 'CUSTOM'
  isConditionModalOpen.value = true
}

const openEditCondition = (conditionId: string) => {
  if (!canWriteContent.value || !activeCombatant.value) return
  const condition = activeConditions.value.find((entry) => entry.id === conditionId)
  if (!condition) return
  resetConditionForm()
  editingConditionId.value = condition.id
  conditionForm.name = condition.name
  conditionForm.duration = condition.duration ?? null
  conditionForm.remaining = condition.remaining ?? null
  conditionForm.tickTiming = condition.tickTiming
  conditionForm.source = condition.source || ''
  conditionForm.notes = condition.notes || ''
  const presetMatch = standardConditionOptions.find(
    (entry) => entry.value !== 'CUSTOM' && entry.label.toLowerCase() === condition.name.toLowerCase(),
  )
  conditionPreset.value = presetMatch?.value || 'CUSTOM'
  isConditionModalOpen.value = true
}

const saveCondition = async () => {
  if (!canWriteContent.value || !activeCombatant.value) return
  isSavingCondition.value = true
  const toOptionalInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
  const toNullableInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
  try {
    await withAction(async () => {
      const effectiveConditionName = conditionPreset.value === 'CUSTOM'
        ? conditionForm.name.trim()
        : standardConditionOptions.find((entry) => entry.value === conditionPreset.value)?.label || conditionForm.name.trim()
      if (editingConditionId.value) {
        await runtimeApi.updateCondition(
          encounterId.value,
          activeCombatant.value!.id,
          editingConditionId.value,
          {
            name: effectiveConditionName,
            duration: toNullableInt(conditionForm.duration),
            remaining: toNullableInt(conditionForm.remaining),
            tickTiming: conditionForm.tickTiming,
            source: conditionForm.source || null,
            notes: conditionForm.notes || null,
          },
        )
      } else {
        await runtimeApi.addCondition(encounterId.value, activeCombatant.value!.id, {
          name: effectiveConditionName,
          duration: toOptionalInt(conditionForm.duration),
          remaining: toOptionalInt(conditionForm.remaining),
          tickTiming: conditionForm.tickTiming,
          source: conditionForm.source || undefined,
          notes: conditionForm.notes || undefined,
        })
      }
      isConditionModalOpen.value = false
    })
  } finally {
    isSavingCondition.value = false
  }
}

const deleteCondition = async (conditionId: string) => {
  if (!canWriteContent.value || !activeCombatant.value) return
  await withAction(() =>
    runtimeApi.deleteCondition(encounterId.value, activeCombatant.value!.id, conditionId),
  )
}

const saveEncounterSettings = async () => {
  if (!canWriteContent.value || !encounter.value) return
  const toNullableInt = (value: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null
  const calendarYear = toNullableInt(encounterSettings.calendarYear)
  const calendarMonth = toNullableInt(encounterSettings.calendarMonth)
  const calendarDay = toNullableInt(encounterSettings.calendarDay)
  const hasAnyDatePart
    = calendarYear !== null
      || calendarMonth !== null
      || calendarDay !== null
  const hasAllDateParts
    = calendarYear !== null
      && calendarMonth !== null
      && calendarDay !== null

  if (hasAnyDatePart && !hasAllDateParts) {
    actionError.value = 'Calendar year, month, and day must all be set, or all left blank.'
    return
  }

  isSavingEncounterSettings.value = true
  await withAction(async () => {
    await detailApi.updateEncounter(encounterId.value, {
      sessionId: encounterSettings.sessionId || null,
      calendarYear: hasAllDateParts ? calendarYear : null,
      calendarMonth: hasAllDateParts ? calendarMonth : null,
      calendarDay: hasAllDateParts ? calendarDay : null,
    })
  })
  isSavingEncounterSettings.value = false
}

const instantiateTemplate = async (templateId: string) => {
  if (!canWriteContent.value) return
  await withAction(async () => {
    await templateApi.instantiateTemplate(templateId, {
      name: `Copy of ${encounter.value?.name || 'Encounter'}`,
      sessionId: encounter.value?.sessionId || undefined,
    })
    await refreshTemplates()
  })
}

const markQuestCompleteFromSummary = async (questId: string = selectedShortcutQuestId.value) => {
  if (!canWriteContent.value || !questId) return
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

const markMilestoneCompleteFromSummary = async (milestoneId: string = selectedShortcutMilestoneId.value) => {
  if (!canWriteContent.value || !milestoneId) return
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

const sideOptions = [
  { label: 'Enemy', value: 'ENEMY' },
  { label: 'Ally', value: 'ALLY' },
  { label: 'Neutral', value: 'NEUTRAL' },
]
const sourceTypeOptions = [
  { label: 'Custom', value: 'CUSTOM' },
  { label: 'Campaign Character', value: 'CAMPAIGN_CHARACTER' },
  { label: 'Player Character', value: 'PLAYER_CHARACTER' },
  { label: 'Glossary Entry', value: 'GLOSSARY_ENTRY' },
]
const statBlockOptions = computed(() =>
  (statBlocks.value || []).map((statBlock) => ({
    label: statBlock.name,
    value: statBlock.id,
  })),
)
const sessionOptions = computed(() =>
  (campaignSessions.value || []).map((session) => ({
    label: session.sessionNumber ? `Session ${session.sessionNumber}: ${session.title}` : session.title,
    value: session.id,
  })),
)
const availableCampaignCharacters = computed(() =>
  (campaignCharacterLinks.value || [])
    .filter((link) => link.status === 'ACTIVE')
    .filter((link) =>
      !sortedCombatants.value.some(
        (combatant) => combatant.sourceCampaignCharacterId === link.character.id,
      ),
    )
    .map((link) => ({
      id: link.character.id,
      label: link.character.name,
    })),
)
const copyCombatantOptions = computed(() =>
  sortedCombatants.value
    .filter((entry) => Boolean(entry.sourceStatBlockId))
    .map((entry) => ({
      label: entry.name,
      value: entry.id,
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
const conditionTimingOptions = [
  { label: 'Turn start', value: 'TURN_START' },
  { label: 'Turn end', value: 'TURN_END' },
  { label: 'Round end', value: 'ROUND_END' },
]
const standardConditionOptions = [
  { label: 'Blinded', value: 'BLINDED' },
  { label: 'Charmed', value: 'CHARMED' },
  { label: 'Deafened', value: 'DEAFENED' },
  { label: 'Exhaustion', value: 'EXHAUSTION' },
  { label: 'Frightened', value: 'FRIGHTENED' },
  { label: 'Grappled', value: 'GRAPPLED' },
  { label: 'Incapacitated', value: 'INCAPACITATED' },
  { label: 'Invisible', value: 'INVISIBLE' },
  { label: 'Paralyzed', value: 'PARALYZED' },
  { label: 'Petrified', value: 'PETRIFIED' },
  { label: 'Poisoned', value: 'POISONED' },
  { label: 'Prone', value: 'PRONE' },
  { label: 'Restrained', value: 'RESTRAINED' },
  { label: 'Stunned', value: 'STUNNED' },
  { label: 'Unconscious', value: 'UNCONSCIOUS' },
  { label: 'Custom condition', value: 'CUSTOM' },
]

watch(
  () => encounter.value,
  (value) => {
    if (!value) return
    encounterSettings.sessionId = value.sessionId || ''
    encounterSettings.calendarYear = value.calendarYear ?? null
    encounterSettings.calendarMonth = value.calendarMonth ?? null
    encounterSettings.calendarDay = value.calendarDay ?? null
    const indexed = [...(value.combatants || [])]
      .sort((left, right) => left.sortOrder - right.sortOrder)[value.currentTurnIndex]
    preferredActiveCombatantId.value = indexed?.id || preferredActiveCombatantId.value
  },
  { immediate: true },
)

let pollingHandle: ReturnType<typeof setInterval> | null = null

watch(
  () => encounter.value?.status,
  (status) => {
    if (pollingHandle) {
      clearInterval(pollingHandle)
      pollingHandle = null
    }
    if (status === 'ACTIVE') {
      pollingHandle = setInterval(() => {
        refreshPreservingUiState()
      }, 5000)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (pollingHandle) clearInterval(pollingHandle)
})

await refreshSummary()
</script>

<template>
  <div class="space-y-6">
    <SharedResourceState
      :pending="initialLoading"
      :error="error"
      :empty="!encounter"
      error-message="Unable to load encounter."
      empty-message="Encounter not found."
      @retry="refreshPreservingUiState"
    >
      <template #default>
        <EncounterRuntimeHeader
          v-if="encounter"
          :name="encounter.name"
          :status="encounter.status"
          :round="encounter.currentRound"
          :can-write="canWriteContent"
          @start="runStatusAction('start')"
          @pause="runStatusAction('pause')"
          @resume="runStatusAction('resume')"
          @complete="runStatusAction('complete')"
          @abandon="runStatusAction('abandon')"
          @reset="runStatusAction('reset')"
          @refresh="refreshPreservingUiState"
        />

        <UAlert
          v-if="!canWriteContent"
          color="warning"
          variant="subtle"
          title="Read-only access"
          description="Your role can view this encounter but cannot change runtime state."
        />

        <UAlert v-if="actionError" color="error" variant="soft" :description="actionError" />

        <div class="grid gap-4 xl:grid-cols-3">
          <div class="space-y-4 xl:col-span-2">
            <EncounterQuickActionsBar
              :can-write="canWriteContent"
              @advance="advanceTurn"
              @rewind="rewindTurn"
              @roll="rollInitiative"
            />

            <EncounterInitiativeBoard
              :combatants="sortedCombatants"
              :active-index="activeIndex"
              :can-write="canWriteContent"
              @select="setActive"
              @move="moveInitiativeItem"
              @manage="openManageCombatants"
              @set-initiative="setManualInitiative"
            />

            <div class="grid gap-3 md:grid-cols-2">
              <EncounterCombatantCard
                v-for="combatant in sortedCombatants"
                :key="combatant.id"
                :combatant="combatant"
                :can-write="canWriteContent"
                @edit="openCombatantEditor(combatant)"
                @delete="deleteCombatant"
              />
            </div>

            <EncounterEventTimeline :events="encounter?.events || []" />

            <UCard>
              <template #header>
                <h2 class="text-base font-semibold">Add note</h2>
              </template>
              <div class="flex flex-wrap gap-2">
                <UInput v-model="noteDraft" class="min-w-[16rem] flex-1" placeholder="Track a quick note" />
                <UButton :disabled="!canWriteContent || !noteDraft.trim()" @click="addNote">Add note</UButton>
              </div>
            </UCard>
          </div>

          <div class="space-y-4">
            <EncounterSummaryPanel
              :summary="summaryPending ? null : summary"
            />

            <UCard>
              <template #header>
                <h2 class="text-base font-semibold">Active combatant</h2>
              </template>
              <div v-if="activeCombatant" class="space-y-2">
                <p class="text-sm font-medium">{{ activeCombatant.name }}</p>
                <div class="flex flex-wrap items-end gap-2">
                  <UInput v-model.number="hpModifier" type="number" class="w-24" />
                  <UButton :disabled="!canWriteContent || !activeCombatant" color="error" variant="soft" @click="quickApplyDamage">Damage</UButton>
                  <UButton :disabled="!canWriteContent || !activeCombatant" color="success" variant="soft" @click="quickApplyHeal">Heal</UButton>
                </div>
                <EncounterConditionChips :conditions="activeConditions" />
                <div class="space-y-2">
                  <div
                    v-for="condition in activeConditions"
                    :key="condition.id"
                    class="flex items-center justify-between gap-2 rounded-md border border-default/70 px-2 py-1"
                  >
                    <p class="text-xs text-muted">
                      {{ condition.name }}
                      <span v-if="typeof condition.remaining === 'number'">({{ condition.remaining }})</span>
                      · {{ condition.tickTiming }}
                    </p>
                    <div class="flex gap-1">
                      <UButton size="xs" variant="ghost" :disabled="!canWriteContent" @click="openEditCondition(condition.id)">Edit</UButton>
                      <SharedConfirmActionPopover
                        message="Remove condition?"
                        content-class="w-72 p-3"
                        confirm-label="Delete"
                        confirm-icon="i-lucide-trash-2"
                        @confirm="({ close }) => { deleteCondition(condition.id); close() }"
                      >
                        <template #trigger>
                          <UButton size="xs" color="error" variant="ghost" :disabled="!canWriteContent">Delete</UButton>
                        </template>
                        <template #content>
                          <p class="text-sm text-muted">Remove {{ condition.name }} from {{ activeCombatant?.name }}?</p>
                        </template>
                      </SharedConfirmActionPopover>
                    </div>
                  </div>
                </div>
                <UButton size="xs" variant="outline" :disabled="!canWriteContent" @click="openCreateCondition">Add condition</UButton>
              </div>
              <p v-else class="text-sm text-muted">No active combatant selected.</p>
            </UCard>

            <EncounterTemplatePicker
              :templates="templates || []"
              :disabled="!canWriteContent"
              @instantiate="instantiateTemplate"
            />

            <UCard>
              <template #header>
                <h2 class="text-base font-semibold">Encounter settings</h2>
              </template>
              <div class="space-y-3">
                <UFormField label="Linked session">
                  <USelect
                    v-model="encounterSettings.sessionId"
                    :items="sessionOptions"
                    placeholder="No linked session"
                  />
                </UFormField>

                <UCard
                  v-if="calendarConfig?.isEnabled"
                  :ui="{ body: 'space-y-3 p-3' }"
                >
                  <p class="text-xs uppercase tracking-[0.2em] text-dimmed">Calendar link</p>
                  <div class="grid gap-2 sm:grid-cols-3">
                    <UFormField label="Year">
                      <UInput v-model.number="encounterSettings.calendarYear" type="number" />
                    </UFormField>
                    <UFormField label="Month">
                      <UInput v-model.number="encounterSettings.calendarMonth" type="number" />
                    </UFormField>
                    <UFormField label="Day">
                      <UInput v-model.number="encounterSettings.calendarDay" type="number" />
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
                    :disabled="!canWriteContent"
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
                <h2 class="text-base font-semibold">Quest & milestone shortcuts</h2>
              </template>
              <div class="space-y-3">
                <div class="flex flex-wrap gap-2">
                  <UButton variant="outline" size="xs" :to="`/campaigns/${campaignId}/quests`">Open quests</UButton>
                  <UButton variant="outline" size="xs" :to="`/campaigns/${campaignId}/milestones`">Open milestones</UButton>
                </div>

                <UFormField label="Mark quest complete">
                  <div class="flex items-center gap-2">
                    <USelect v-model="selectedShortcutQuestId" class="flex-1" :items="activeQuestOptions" placeholder="Select quest" />
                    <UButton
                      size="xs"
                      :disabled="!canWriteContent || !selectedShortcutQuestId"
                      :loading="isSavingSummaryShortcut"
                      @click="markQuestCompleteFromSummary()"
                    >
                      Complete
                    </UButton>
                  </div>
                </UFormField>

                <UFormField label="Mark milestone complete">
                  <div class="flex items-center gap-2">
                    <USelect v-model="selectedShortcutMilestoneId" class="flex-1" :items="openMilestoneOptions" placeholder="Select milestone" />
                    <UButton
                      size="xs"
                      :disabled="!canWriteContent || !selectedShortcutMilestoneId"
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
        </div>
      </template>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="isManageCombatantsOpen"
      title="Manage combatants"
      submit-label="Add"
      :saving="isSavingManageCombatants"
      :error="actionError"
      @submit="saveManageCombatants"
    >
      <UFormField label="Add mode">
        <USelect
          v-model="manageCombatantMode"
          :items="[
            { label: 'Campaign PC', value: 'pc' },
            { label: 'Campaign stat block', value: 'statblock' },
            { label: 'Custom combatant', value: 'custom' },
            { label: 'Copy existing stat block combatant', value: 'copy' },
          ]"
        />
      </UFormField>

      <template v-if="manageCombatantMode === 'pc'">
        <UFormField label="Campaign PCs">
          <div v-if="availableCampaignCharacters.length" class="max-h-52 space-y-2 overflow-auto rounded-md border border-default p-2">
            <UCheckbox
              v-for="character in availableCampaignCharacters"
              :key="character.id"
              :model-value="selectedCampaignCharacterIds.includes(character.id)"
              :label="character.label"
              @update:model-value="(checked) => toggleCampaignPcSelection(character.id, Boolean(checked))"
            />
          </div>
          <p v-else class="text-sm text-muted">All active campaign PCs are already in this encounter.</p>
        </UFormField>
      </template>

      <template v-else-if="manageCombatantMode === 'statblock'">
        <UFormField label="Stat block">
          <USelect v-model="selectedStatBlockId" :items="statBlockOptions" placeholder="Select stat block" />
        </UFormField>
        <UFormField label="Quantity">
          <UInput v-model.number="manageQuantity" type="number" min="1" />
        </UFormField>
      </template>

      <template v-else-if="manageCombatantMode === 'copy'">
        <UFormField label="Source combatant">
          <USelect v-model="copySourceCombatantId" :items="copyCombatantOptions" placeholder="Select combatant" />
        </UFormField>
        <UFormField label="Quantity">
          <UInput v-model.number="manageQuantity" type="number" min="1" />
        </UFormField>
      </template>

      <template v-else>
        <UFormField label="Name">
          <UInput v-model="customCombatantForm.name" placeholder="Custom combatant" />
        </UFormField>
        <UFormField label="Side">
          <USelect v-model="customCombatantForm.side" :items="sideOptions" />
        </UFormField>
        <div class="grid gap-3 md:grid-cols-3">
          <UFormField label="Max HP">
            <UInput v-model.number="customCombatantForm.maxHp" type="number" />
          </UFormField>
          <UFormField label="Armor Class">
            <UInput v-model.number="customCombatantForm.armorClass" type="number" />
          </UFormField>
          <UFormField label="Speed">
            <UInput v-model.number="customCombatantForm.speed" type="number" />
          </UFormField>
        </div>
      </template>
    </SharedEntityFormModal>

    <SharedEntityFormModal
      v-model:open="isConditionModalOpen"
      :title="editingConditionId ? 'Edit condition' : 'Add condition'"
      submit-label="Save"
      :saving="isSavingCondition"
      :error="actionError"
      @submit="saveCondition"
    >
      <UFormField label="Condition">
        <USelect v-model="conditionPreset" :items="standardConditionOptions" />
      </UFormField>
      <UFormField v-if="conditionPreset === 'CUSTOM'" label="Custom name">
        <UInput v-model="conditionForm.name" placeholder="Custom condition name" />
      </UFormField>
      <div class="grid gap-3 md:grid-cols-3">
        <UFormField label="Duration">
          <UInput v-model.number="conditionForm.duration" type="number" />
        </UFormField>
        <UFormField label="Remaining">
          <UInput v-model.number="conditionForm.remaining" type="number" />
        </UFormField>
        <UFormField label="Tick timing">
          <USelect v-model="conditionForm.tickTiming" :items="conditionTimingOptions" />
        </UFormField>
      </div>
      <UFormField label="Source">
        <UInput v-model="conditionForm.source" placeholder="Hold Person" />
      </UFormField>
      <UFormField label="Notes">
        <UTextarea v-model="conditionForm.notes" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>

    <SharedEntityFormModal
      v-model:open="isCombatantEditOpen"
      title="Edit combatant"
      submit-label="Save"
      :saving="isSavingCombatant"
      :error="actionError"
      @submit="saveCombatantEditor"
    >
      <UFormField label="Name">
        <UInput v-model="combatantForm.name" />
      </UFormField>
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="Side">
          <USelect v-model="combatantForm.side" :items="sideOptions" />
        </UFormField>
        <UFormField label="Source type">
          <USelect v-model="combatantForm.sourceType" :items="sourceTypeOptions" />
        </UFormField>
      </div>
      <UFormField label="Stat block" v-if="combatantForm.sourceType !== 'CUSTOM'">
        <USelect v-model="combatantForm.sourceStatBlockId" :items="statBlockOptions" />
      </UFormField>
      <div class="grid gap-3 md:grid-cols-3">
        <UFormField label="Max HP">
          <UInput v-model.number="combatantForm.maxHp" type="number" />
        </UFormField>
        <UFormField label="Current HP">
          <UInput v-model.number="combatantForm.currentHp" type="number" />
        </UFormField>
        <UFormField label="Temp HP">
          <UInput v-model.number="combatantForm.tempHp" type="number" />
        </UFormField>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField label="Armor Class">
          <UInput v-model.number="combatantForm.armorClass" type="number" />
        </UFormField>
        <UFormField label="Speed">
          <UInput v-model.number="combatantForm.speed" type="number" />
        </UFormField>
      </div>
      <UFormField label="Notes">
        <UTextarea v-model="combatantForm.notes" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>
