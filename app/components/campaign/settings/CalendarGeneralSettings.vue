<script setup lang="ts">
import { useCampaignCalendar, type CampaignCalendarConfigDto } from '~/composables/useCampaignCalendar'
import { calendarConfigUpsertSchema } from '#shared/schemas/calendar'
import type { CalendarTemplateId } from '#shared/types/calendar'

const props = defineProps<{
  campaignId: string
  canEdit: boolean
}>()

const calendarApi = useCampaignCalendar()

type CalendarDraft = {
  isEnabled: boolean
  name: string
  startingYear: number
  firstWeekdayIndex: number
  currentYear: number
  currentMonth: number
  currentDay: number
  weekdays: Array<{ name: string }>
  months: Array<{ name: string, length: number }>
  moons: Array<{ name: string, cycleLength: number, phaseOffset: number }>
}

const makeDefaultDraft = (): CalendarDraft => ({
  isEnabled: false,
  name: 'Fantasy Calendar',
  startingYear: 1,
  firstWeekdayIndex: 0,
  currentYear: 1,
  currentMonth: 1,
  currentDay: 1,
  weekdays: [{ name: 'Moonday' }],
  months: [{ name: 'Month 1', length: 30 }],
  moons: [],
})

const toDraft = (config: CampaignCalendarConfigDto | null): CalendarDraft => {
  if (!config) return makeDefaultDraft()
  return {
    isEnabled: config.isEnabled,
    name: config.name,
    startingYear: config.startingYear,
    firstWeekdayIndex: config.firstWeekdayIndex,
    currentYear: config.currentYear,
    currentMonth: config.currentMonth,
    currentDay: config.currentDay,
    weekdays: config.weekdays.map(item => ({ ...item })),
    months: config.months.map(item => ({ ...item })),
    moons: config.moons.map(item => ({ ...item })),
  }
}

const templateOptions = [
  { label: 'Earth', value: 'earth' },
  { label: 'Tonalpohualli-inspired', value: 'tonalpohualli' },
  { label: 'Fantasy Example A', value: 'fantasy_a' },
  { label: 'Fantasy Example B', value: 'fantasy_b' },
  { label: 'Randomly Generated', value: 'random' },
]

const state = reactive({
  loading: true,
  loaded: false,
  loadError: '',
  templateError: '',
  saving: false,
  applyingTemplate: false,
  generatingKey: '',
  saveError: '',
  saveSuccess: '',
  hasExistingConfig: false,
})

const selectedTemplate = ref<CalendarTemplateId>('earth')
const templateConfirmOpen = ref(false)
const config = ref<CampaignCalendarConfigDto | null>(null)
const draft = reactive<CalendarDraft>(makeDefaultDraft())

const baseline = ref(JSON.stringify(draft))
const dirty = computed(() => state.loaded && JSON.stringify(draft) !== baseline.value)
const busy = computed(() => state.loading || state.saving || state.applyingTemplate || Boolean(state.generatingKey))
const editingDisabled = computed(() => !props.canEdit || busy.value)
useUnsavedChanges(dirty, busy)
const discardChanges = () => {
  if (busy.value) return
  Object.assign(draft, JSON.parse(baseline.value))
  state.saveError = ''
  state.saveSuccess = ''
}
const templateCancel = useTemplateRef('templateCancel')
const focusTemplateCancel = (event: Event) => { event.preventDefault(); templateCancel.value?.$el?.focus() }

const monthOptions = computed(() =>
  draft.months.map((month, index) => ({
    label: `${index + 1}: ${month.name || `Month ${index + 1}`}`,
    value: index + 1,
  })),
)

const weekdayOptions = computed(() =>
  draft.weekdays.map((weekday, index) => ({
    label: `${index}: ${weekday.name || `Weekday ${index + 1}`}`,
    value: index,
  })),
)

const maxCurrentDay = computed(() => draft.months[draft.currentMonth - 1]?.length || 1)
const canShowTemplateStarter = computed(() => !state.hasExistingConfig || !config.value)

const normalizeDraft = () => {
  if (draft.weekdays.length < 1) {
    draft.weekdays.push({ name: 'Moonday' })
  }
  if (draft.months.length < 1) {
    draft.months.push({ name: 'Month 1', length: 30 })
  }
  if (draft.firstWeekdayIndex >= draft.weekdays.length) {
    draft.firstWeekdayIndex = Math.max(0, draft.weekdays.length - 1)
  }
  if (draft.currentMonth < 1) draft.currentMonth = 1
  if (draft.currentMonth > draft.months.length) draft.currentMonth = draft.months.length
  if (draft.currentDay < 1) draft.currentDay = 1
  if (draft.currentDay > maxCurrentDay.value) draft.currentDay = maxCurrentDay.value
}

const resetFromConfig = (nextConfig: CampaignCalendarConfigDto | null) => {
  config.value = nextConfig
  state.hasExistingConfig = Boolean(nextConfig)
  const next = toDraft(nextConfig)
  Object.assign(draft, next)
  normalizeDraft()
  baseline.value = JSON.stringify(draft)
}

const loadConfig = async () => {
  state.loading = true
  state.loadError = ''
  try {
    const current = await calendarApi.getConfig(props.campaignId)
    resetFromConfig(current)
    state.loaded = true
  }
  catch (error) {
    state.loadError = (error as Error).message || 'Unable to load calendar settings.'
  }
  finally {
    state.loading = false
  }
}

const saveConfig = async () => {
  if (editingDisabled.value || !dirty.value) return
  const parsed = calendarConfigUpsertSchema.safeParse(draft)
  if (!parsed.success) { state.saveError = parsed.error.issues[0]?.message || 'Check the calendar fields.'; return }
  state.saveError = ''
  state.saveSuccess = ''
  state.saving = true
  normalizeDraft()
  try {
    const saved = await calendarApi.upsertConfig(props.campaignId, parsed.data)
    if (!saved) throw new Error('Unable to save calendar settings.')
    resetFromConfig(saved)
    state.saveSuccess = 'Calendar settings saved.'
  }
  catch (error) {
    state.saveError = (error as Error).message || 'Unable to save calendar settings.'
  }
  finally {
    state.saving = false
  }
}

const addWeekday = () => {
  draft.weekdays.push({ name: `Weekday ${draft.weekdays.length + 1}` })
}

const addMonth = () => {
  draft.months.push({ name: `Month ${draft.months.length + 1}`, length: 30 })
  normalizeDraft()
}

const addMoon = () => {
  draft.moons.push({ name: `Moon ${draft.moons.length + 1}`, cycleLength: 28, phaseOffset: 0 })
}

const removeWeekday = (index: number) => {
  if (draft.weekdays.length <= 1) return
  draft.weekdays.splice(index, 1)
  normalizeDraft()
}

const removeMonth = (index: number) => {
  if (draft.months.length <= 1) return
  draft.months.splice(index, 1)
  normalizeDraft()
}

const removeMoon = (index: number) => {
  draft.moons.splice(index, 1)
}

const moveItem = <T,>(items: T[], from: number, direction: -1 | 1) => {
  const nextIndex = from + direction
  if (nextIndex < 0 || nextIndex >= items.length) return
  const [entry] = items.splice(from, 1)
  if (!entry) return
  items.splice(nextIndex, 0, entry)
}

const generateName = async (
  kind: 'weekday' | 'month' | 'moon',
  index: number,
) => {
  if (editingDisabled.value) return
  state.generatingKey = `${kind}-${index}`
  state.saveError = ''
  try {
    const generated = await calendarApi.generateNames(props.campaignId, { kind, count: 1 })
    if (!generated) return
    const name = generated.names[0]
    if (!name) return
    if (kind === 'weekday') draft.weekdays[index]!.name = name
    if (kind === 'month') draft.months[index]!.name = name
    if (kind === 'moon') draft.moons[index]!.name = name
  }
  catch (error) {
    state.saveError = (error as Error).message || 'Unable to generate name.'
  }
  finally {
    state.generatingKey = ''
  }
}

const openTemplateConfirmation = () => {
  if (editingDisabled.value) return
  state.templateError = ''
  if (!state.hasExistingConfig && !dirty.value) {
    void applyTemplate()
    return
  }
  templateConfirmOpen.value = true
}

const applyTemplate = async () => {
  if (editingDisabled.value) return
  state.templateError = ''
  state.applyingTemplate = true
  state.saveError = ''
  state.saveSuccess = ''
  try {
    const applied = await calendarApi.applyTemplate(props.campaignId, { templateId: selectedTemplate.value })
    if (!applied) throw new Error('Unable to apply template.')
    resetFromConfig(applied)
    templateConfirmOpen.value = false
    state.saveSuccess = 'Template applied.'
  }
  catch (error) {
    state.templateError = (error as Error).message || 'Unable to apply template.'
    state.saveError = state.templateError
  }
  finally {
    state.applyingTemplate = false
  }
}

watch(
  () => draft.currentMonth,
  () => {
    normalizeDraft()
  },
)

watch(
  () => draft.months.map((month) => month.length),
  () => {
    normalizeDraft()
  },
)

onMounted(() => {
  void loadConfig()
})
</script>

<template>
  <div class="space-y-4">
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-1">
          <h2 class="type-section flex items-center gap-2"><UIcon name="i-lucide-calendar-days" class="size-5 text-primary" aria-hidden="true" /> Campaign calendar</h2>
          <p class="text-sm text-muted">Set the rhythm of your world, from its days and seasons to its moons.</p>
        </div>
        <UBadge v-if="dirty" color="neutral" variant="subtle">Unsaved changes</UBadge>
      </div>
    </template>
    <SharedResourceState :pending="state.loading" :error="state.loadError" :has-data="state.loaded" error-message="Unable to load calendar settings." @retry="loadConfig">
      <SharedReadOnlyAlert v-if="!canEdit" class="mb-4" description="Only the owner and collaborators can edit the campaign calendar." />
      <UForm :state="draft" :schema="calendarConfigUpsertSchema" :disabled="editingDisabled" class="space-y-6" @submit="saveConfig">
        <div class="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
          <USwitch v-model="draft.isEnabled" label="Enable fantasy calendar" description="Use custom dates throughout this campaign. Changes take effect when saved." :disabled="editingDisabled" />
          <div class="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <UFormField label="Calendar template" description="Applying a template saves its calendar immediately.">
              <USelect v-model="selectedTemplate" :items="templateOptions" class="w-full" :disabled="editingDisabled" />
            </UFormField>
            <UButton color="neutral" variant="outline" icon="i-lucide-wand-sparkles" :disabled="editingDisabled" :loading="state.applyingTemplate" @click="openTemplateConfirmation">{{ canShowTemplateStarter ? 'Start from template' : 'Apply template' }}</UButton>
          </div>
        </div>
        <section class="space-y-4" aria-labelledby="calendar-date-title">
          <h3 id="calendar-date-title" class="type-record">Name and current date</h3>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UFormField label="Calendar name" name="name" required><UInput v-model="draft.name" class="w-full" /></UFormField>
            <UFormField label="Starting year" name="startingYear"><UInput v-model.number="draft.startingYear" type="number" class="w-full" /></UFormField>
            <UFormField label="First weekday" name="firstWeekdayIndex"><USelect v-model="draft.firstWeekdayIndex" :items="weekdayOptions" class="w-full" /></UFormField>
            <UFormField label="Current year" name="currentYear"><UInput v-model.number="draft.currentYear" type="number" class="w-full" /></UFormField>
            <UFormField label="Current month" name="currentMonth"><USelect v-model="draft.currentMonth" :items="monthOptions" class="w-full" /></UFormField>
            <UFormField label="Current day" name="currentDay"><UInput v-model.number="draft.currentDay" type="number" :min="1" :max="maxCurrentDay" class="w-full" /></UFormField>
          </div>
        </section>
        <UCard variant="soft">
          <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="type-record flex items-center gap-2"><UIcon name="i-lucide-sun" class="size-4 text-primary" aria-hidden="true" /> Weekdays</h3><p class="mt-1 text-sm text-muted">Days repeat in the order shown.</p></div><UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="editingDisabled" @click="addWeekday">Add weekday</UButton></div></template>
          <p v-if="!draft.weekdays.length" class="text-sm text-muted">No weekdays configured. Add a weekday to begin.</p>
          <div class="divide-y divide-default">
            <div v-for="(item, index) in draft.weekdays" :key="index" class="grid items-end gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid gap-3 ">
                <UFormField :label="'Weekday ' + (index + 1) + ' name'" :name="'weekdays.' + index + '.name'" required><UInput v-model="item.name" class="w-full" /></UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UTooltip text="Move up"><UButton color="neutral" variant="outline" icon="i-lucide-chevron-up" :aria-label="'Move weekday ' + (index + 1) + ' up'" :disabled="editingDisabled || index === 0" @click="moveItem(draft.weekdays, index, -1)" /></UTooltip>
                <UTooltip text="Move down"><UButton color="neutral" variant="outline" icon="i-lucide-chevron-down" :aria-label="'Move weekday ' + (index + 1) + ' down'" :disabled="editingDisabled || index === draft.weekdays.length - 1" @click="moveItem(draft.weekdays, index, 1)" /></UTooltip>
                <UButton color="neutral" variant="soft" icon="i-lucide-sparkles" :loading="state.generatingKey === 'weekday-' + index" :disabled="editingDisabled" @click="generateName('weekday', index)">Generate</UButton>
                <UTooltip text="Remove weekday"><UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="'Remove weekday ' + (index + 1)" :disabled="editingDisabled || draft.weekdays.length <= 1" @click="removeWeekday(index)" /></UTooltip>
              </div>
            </div>
          </div>
        </UCard>
        <UCard variant="soft">
          <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="type-record flex items-center gap-2"><UIcon name="i-lucide-leaf" class="size-4 text-primary" aria-hidden="true" /> Months</h3><p class="mt-1 text-sm text-muted">Set each month’s name and length in days.</p></div><UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="editingDisabled" @click="addMonth">Add month</UButton></div></template>
          <p v-if="!draft.months.length" class="text-sm text-muted">No months configured. Add a month to begin.</p>
          <div class="divide-y divide-default">
            <div v-for="(item, index) in draft.months" :key="index" class="grid items-end gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <UFormField :label="'Month ' + (index + 1) + ' name'" :name="'months.' + index + '.name'" required><UInput v-model="item.name" class="w-full" /></UFormField>
                <UFormField label="Days" :name="'months.' + index + '.length'"><UInput v-model.number="item.length" type="number" :min="1" :max="999" class="w-full" /></UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UTooltip text="Move up"><UButton color="neutral" variant="outline" icon="i-lucide-chevron-up" :aria-label="'Move month ' + (index + 1) + ' up'" :disabled="editingDisabled || index === 0" @click="moveItem(draft.months, index, -1)" /></UTooltip>
                <UTooltip text="Move down"><UButton color="neutral" variant="outline" icon="i-lucide-chevron-down" :aria-label="'Move month ' + (index + 1) + ' down'" :disabled="editingDisabled || index === draft.months.length - 1" @click="moveItem(draft.months, index, 1)" /></UTooltip>
                <UButton color="neutral" variant="soft" icon="i-lucide-sparkles" :loading="state.generatingKey === 'month-' + index" :disabled="editingDisabled" @click="generateName('month', index)">Generate</UButton>
                <UTooltip text="Remove month"><UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="'Remove month ' + (index + 1)" :disabled="editingDisabled || draft.months.length <= 1" @click="removeMonth(index)" /></UTooltip>
              </div>
            </div>
          </div>
        </UCard>
        <UCard variant="soft">
          <template #header><div class="flex flex-wrap items-center justify-between gap-3"><div><h3 class="type-record flex items-center gap-2"><UIcon name="i-lucide-moon-star" class="size-4 text-primary" aria-hidden="true" /> Moons</h3><p class="mt-1 text-sm text-muted">Track lunar cycles and their starting offsets.</p></div><UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="editingDisabled" @click="addMoon">Add moon</UButton></div></template>
          <p v-if="!draft.moons.length" class="text-sm text-muted">No moons configured. Add a moon to begin.</p>
          <div class="divide-y divide-default">
            <div v-for="(item, index) in draft.moons" :key="index" class="grid items-end gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
                <UFormField :label="'Moon ' + (index + 1) + ' name'" :name="'moons.' + index + '.name'" required><UInput v-model="item.name" class="w-full" /></UFormField>
                <UFormField label="Cycle (days)" :name="'moons.' + index + '.cycleLength'"><UInput v-model.number="item.cycleLength" type="number" :min="1" :max="9999" class="w-full" /></UFormField>
                <UFormField label="Offset (days)" :name="'moons.' + index + '.phaseOffset'"><UInput v-model.number="item.phaseOffset" type="number" :min="0" :max="9999" class="w-full" /></UFormField>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton color="neutral" variant="soft" icon="i-lucide-sparkles" :loading="state.generatingKey === 'moon-' + index" :disabled="editingDisabled" @click="generateName('moon', index)">Generate</UButton>
                <UTooltip text="Remove moon"><UButton color="neutral" variant="ghost" icon="i-lucide-trash-2" :aria-label="'Remove moon ' + (index + 1)" :disabled="editingDisabled" @click="removeMoon(index)" /></UTooltip>
              </div>
            </div>
          </div>
        </UCard>
        <div class="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default bg-default p-4 shadow-sm">
          <div aria-live="polite"><p v-if="state.saveError" role="alert" class="text-sm text-error">{{ state.saveError }}</p><p v-else-if="state.saveSuccess && !dirty" class="text-sm text-success">{{ state.saveSuccess }}</p><p v-else class="text-sm text-muted">{{ dirty ? 'Your changes are ready to save.' : 'Calendar settings are up to date.' }}</p></div>
          <div class="flex flex-wrap gap-2"><UButton color="neutral" variant="outline" :disabled="editingDisabled || !dirty" @click="discardChanges">Discard changes</UButton><UButton type="submit" color="primary" variant="solid" icon="i-lucide-save" :disabled="editingDisabled || !dirty" :loading="state.saving">Save calendar settings</UButton></div>
        </div>
      </UForm>
    </SharedResourceState>
  </UCard>
  <UModal v-model:open="templateConfirmOpen" title="Replace campaign calendar?" description="This immediately replaces the saved weekdays, months, moons, and current date. Unsaved calendar changes will also be lost." :close="false" :dismissible="!state.applyingTemplate" :content="{ onOpenAutoFocus: focusTemplateCancel }">
    <template #body><p class="text-sm text-muted">Selected template: <strong class="text-highlighted">{{ templateOptions.find(item => item.value === selectedTemplate)?.label }}</strong></p><p v-if="state.templateError" role="alert" class="mt-3 text-sm text-error">{{ state.templateError }}</p></template>
    <template #footer><div class="flex w-full justify-end gap-2"><UButton ref="templateCancel" color="neutral" variant="outline" :disabled="state.applyingTemplate" @click="templateConfirmOpen = false">Cancel</UButton><UButton color="error" variant="solid" :loading="state.applyingTemplate" :disabled="state.applyingTemplate" @click="applyTemplate">Apply template</UButton></div></template>
  </UModal>
  </div>
</template>
