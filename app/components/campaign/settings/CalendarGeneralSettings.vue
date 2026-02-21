<script setup lang="ts">
import { useCampaignCalendar, type CampaignCalendarConfigDto } from '~/composables/useCampaignCalendar'
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
    weekdays: [...config.weekdays],
    months: [...config.months],
    moons: [...config.moons],
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
  saving: false,
  applyingTemplate: false,
  generatingKey: '',
  saveError: '',
  saveSuccess: '',
  hasExistingConfig: false,
})

const selectedTemplate = ref<CalendarTemplateId>('earth')
const templateConfirmOpen = ref(false)
const disableConfirmOpen = ref(false)
const config = ref<CampaignCalendarConfigDto | null>(null)
const draft = reactive<CalendarDraft>(makeDefaultDraft())

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
}

const loadConfig = async () => {
  state.loading = true
  state.saveError = ''
  try {
    const current = await calendarApi.getConfig(props.campaignId)
    resetFromConfig(current)
  }
  catch (error) {
    state.saveError = (error as Error).message || 'Unable to load calendar settings.'
  }
  finally {
    state.loading = false
  }
}

const saveConfig = async () => {
  state.saveError = ''
  state.saveSuccess = ''
  state.saving = true
  normalizeDraft()
  try {
    const saved = await calendarApi.upsertConfig(props.campaignId, {
      isEnabled: draft.isEnabled,
      name: draft.name,
      startingYear: draft.startingYear,
      firstWeekdayIndex: draft.firstWeekdayIndex,
      currentYear: draft.currentYear,
      currentMonth: draft.currentMonth,
      currentDay: draft.currentDay,
      weekdays: draft.weekdays,
      months: draft.months,
      moons: draft.moons,
    })
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

const onEnableToggle = (value: boolean) => {
  if (!value && draft.isEnabled) {
    disableConfirmOpen.value = true
    return
  }
  draft.isEnabled = value
}

const confirmDisable = () => {
  draft.isEnabled = false
  disableConfirmOpen.value = false
}

const openTemplateConfirmation = () => {
  if (!state.hasExistingConfig || !config.value) {
    void applyTemplate()
    return
  }
  templateConfirmOpen.value = true
}

const applyTemplate = async () => {
  state.applyingTemplate = true
  state.saveError = ''
  state.saveSuccess = ''
  try {
    const applied = await calendarApi.applyTemplate(props.campaignId, { templateId: selectedTemplate.value })
    resetFromConfig(applied)
    state.saveSuccess = 'Template applied.'
  }
  catch (error) {
    state.saveError = (error as Error).message || 'Unable to apply template.'
  }
  finally {
    state.applyingTemplate = false
    templateConfirmOpen.value = false
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
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h2 class="text-lg font-semibold">General</h2>
        <p class="text-sm text-muted">
          Configure the campaign fantasy calendar, templates, and current in-world date.
        </p>
      </div>
    </template>

    <div v-if="state.loading" class="space-y-2">
      <div class="h-10 w-full animate-pulse rounded bg-muted" />
      <div class="h-10 w-full animate-pulse rounded bg-muted" />
      <div class="h-10 w-full animate-pulse rounded bg-muted" />
    </div>

    <div v-else class="space-y-6">
      <UAlert
        v-if="!canEdit"
        color="warning"
        variant="subtle"
        title="Read-only access"
        description="You can view calendar settings, but only owner and collaborators can edit."
      />

      <div class="rounded-lg border border-default p-4 space-y-4">
        <USwitch
          :model-value="draft.isEnabled"
          label="Enable campaign fantasy calendar"
          description="Turn on custom in-world calendar rules for this campaign."
          :disabled="!canEdit"
          @update:model-value="onEnableToggle"
        />

        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
          <USelect
            v-model="selectedTemplate"
            :items="templateOptions"
            :disabled="!canEdit"
          />
          <UButton
            color="warning"
            variant="soft"
            :disabled="!canEdit"
            :loading="state.applyingTemplate"
            @click="openTemplateConfirmation"
          >
            {{ canShowTemplateStarter ? 'Start from template' : 'Apply template' }}
          </UButton>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold">Weekdays</h3>
              <UButton size="xs" variant="outline" :disabled="!canEdit" @click="addWeekday">Add weekday</UButton>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="(weekday, index) in draft.weekdays"
              :key="`weekday-${index}`"
              class="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
            >
              <UInput v-model="weekday.name" :disabled="!canEdit" />
              <UButton
                size="xs"
                variant="outline"
                :disabled="!canEdit || index === 0"
                @click="moveItem(draft.weekdays, index, -1)"
              >
                Up
              </UButton>
              <UButton
                size="xs"
                variant="outline"
                :disabled="!canEdit || index === draft.weekdays.length - 1"
                @click="moveItem(draft.weekdays, index, 1)"
              >
                Down
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                :loading="state.generatingKey === `weekday-${index}`"
                :disabled="!canEdit"
                @click="generateName('weekday', index)"
              >
                Generate
              </UButton>
              <UButton size="xs" color="error" variant="ghost" :disabled="!canEdit || draft.weekdays.length <= 1" @click="removeWeekday(index)">
                Remove
              </UButton>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-semibold">Months</h3>
              <UButton size="xs" variant="outline" :disabled="!canEdit" @click="addMonth">Add month</UButton>
            </div>
          </template>
          <div class="space-y-2">
            <div
              v-for="(month, index) in draft.months"
              :key="`month-${index}`"
              class="grid gap-2 sm:grid-cols-[1fr_110px_auto_auto_auto_auto]"
            >
              <UInput v-model="month.name" :disabled="!canEdit" />
              <UInput v-model.number="month.length" type="number" min="1" max="999" :disabled="!canEdit" />
              <UButton
                size="xs"
                variant="outline"
                :disabled="!canEdit || index === 0"
                @click="moveItem(draft.months, index, -1)"
              >
                Up
              </UButton>
              <UButton
                size="xs"
                variant="outline"
                :disabled="!canEdit || index === draft.months.length - 1"
                @click="moveItem(draft.months, index, 1)"
              >
                Down
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                :loading="state.generatingKey === `month-${index}`"
                :disabled="!canEdit"
                @click="generateName('month', index)"
              >
                Generate
              </UButton>
              <UButton size="xs" color="error" variant="ghost" :disabled="!canEdit || draft.months.length <= 1" @click="removeMonth(index)">
                Remove
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-semibold">Moons</h3>
            <UButton size="xs" variant="outline" :disabled="!canEdit" @click="addMoon">Add moon</UButton>
          </div>
        </template>
        <div v-if="!draft.moons.length" class="text-sm text-muted">
          No moons configured.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="(moon, index) in draft.moons"
            :key="`moon-${index}`"
            class="grid gap-2 sm:grid-cols-[1fr_130px_130px_auto_auto]"
          >
            <UInput v-model="moon.name" :disabled="!canEdit" />
            <UInput v-model.number="moon.cycleLength" type="number" min="1" max="9999" :disabled="!canEdit" />
            <UInput v-model.number="moon.phaseOffset" type="number" min="0" max="9999" :disabled="!canEdit" />
            <UButton
              size="xs"
              variant="soft"
              :loading="state.generatingKey === `moon-${index}`"
              :disabled="!canEdit"
              @click="generateName('moon', index)"
            >
              Generate
            </UButton>
            <UButton size="xs" color="error" variant="ghost" :disabled="!canEdit" @click="removeMoon(index)">Remove</UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="font-semibold">Reference Year + Current Date</h3>
        </template>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Calendar name</p>
            <UInput v-model="draft.name" :disabled="!canEdit" />
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Starting year</p>
            <UInput v-model.number="draft.startingYear" type="number" :disabled="!canEdit" />
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">First weekday index</p>
            <USelect v-model="draft.firstWeekdayIndex" :items="weekdayOptions" :disabled="!canEdit" />
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Current year</p>
            <UInput v-model.number="draft.currentYear" type="number" :disabled="!canEdit" />
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Current month</p>
            <USelect v-model="draft.currentMonth" :items="monthOptions" :disabled="!canEdit" />
          </div>
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Current day</p>
            <UInput
              v-model.number="draft.currentDay"
              type="number"
              min="1"
              :max="maxCurrentDay"
              :disabled="!canEdit"
            />
          </div>
        </div>
      </UCard>

      <div class="flex flex-wrap items-center gap-3">
        <UButton :disabled="!canEdit" :loading="state.saving" @click="saveConfig">Save calendar settings</UButton>
        <UButton variant="ghost" color="neutral" :loading="state.loading" @click="loadConfig">Reload</UButton>
        <p v-if="state.saveSuccess" class="text-sm text-success">{{ state.saveSuccess }}</p>
        <p v-if="state.saveError" class="text-sm text-error">{{ state.saveError }}</p>
      </div>
    </div>
  </UCard>

  <UModal
    v-model:open="disableConfirmOpen"
    title="Disable fantasy calendar?"
    description="Disabling keeps saved data, but calendar features will be inactive until re-enabled."
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="disableConfirmOpen = false">Cancel</UButton>
        <UButton color="error" @click="confirmDisable">Disable</UButton>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="templateConfirmOpen"
    title="Overwrite current calendar configuration?"
    description="Applying a template replaces weekdays, months, moons, and current date settings."
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="templateConfirmOpen = false">Cancel</UButton>
        <UButton color="warning" :loading="state.applyingTemplate" @click="applyTemplate">Apply template</UButton>
      </div>
    </template>
  </UModal>
</template>
