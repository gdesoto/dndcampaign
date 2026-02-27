<script setup lang="ts">
import { useCampaignCalendar } from '~/composables/useCampaignCalendar'

definePageMeta({ layout: 'dashboard' })

type SessionItem = {
  id: string
  title: string
  sessionNumber?: number | null
  playedAt?: string | null
}

type CampaignPermission =
  | 'campaign.read'
  | 'campaign.update'
  | 'campaign.delete'
  | 'campaign.members.manage'
  | 'campaign.settings.manage'
  | 'campaign.public.manage'
  | 'content.read'
  | 'content.write'
  | 'recording.upload'
  | 'recording.transcribe'
  | 'document.edit'
  | 'summary.run'

type CampaignAccess = {
  role: 'OWNER' | 'COLLABORATOR' | 'VIEWER'
  hasDmAccess: boolean
  permissions: CampaignPermission[]
} | null

const route = useRoute()
const campaignId = computed(() => route.params.campaignId as string)
const campaignAccess = inject<ComputedRef<CampaignAccess>>('campaignAccess', computed(() => null))
const canEditCalendar = computed(() => Boolean(campaignAccess.value?.permissions.includes('campaign.update')))
const { request } = useApi()
const calendarApi = useCampaignCalendar()

const selectedYear = ref<number | null>(null)
const selectedMonth = ref<number | null>(null)
const selectedDay = ref(1)

const {
  data: calendarView,
  pending: calendarPending,
  error: calendarError,
  refresh: refreshCalendarView,
} = await useAsyncData(
  () => `campaign-calendar-view-${campaignId.value}`,
  () =>
    calendarApi.getCalendarView(campaignId.value, {
      year: selectedYear.value || undefined,
      month: selectedMonth.value || undefined,
    }),
  {
    watch: [selectedYear, selectedMonth],
  },
)

const {
  data: sessionRanges,
  pending: sessionRangesPending,
  error: sessionRangesError,
  refresh: refreshSessionRanges,
} = await useAsyncData(
  () => `campaign-calendar-ranges-${campaignId.value}`,
  () => calendarApi.getRanges(campaignId.value),
)

const {
  data: sessions,
  pending: sessionsPending,
  error: sessionsError,
  refresh: refreshSessions,
} = await useAsyncData(
  () => `campaign-calendar-sessions-${campaignId.value}`,
  () => request<SessionItem[]>(`/api/campaigns/${campaignId.value}/sessions`),
)

const isCalendarEnabled = computed(() => Boolean(calendarView.value?.config?.isEnabled))
const selectedMonthMeta = computed(() => calendarView.value?.selectedMonth || null)
const selectedDayEvents = computed(() =>
  (calendarView.value?.events || []).filter((event) => event.day === selectedDay.value),
)
const selectedDayRanges = computed(() => {
  const month = selectedMonthMeta.value
  if (!month) return []
  return allRangesWithSession.value.filter((range) =>
    rangeIntersectsDay(range, { year: month.year, month: month.month, day: selectedDay.value }),
  )
})
const yearMonthLabel = computed(() => {
  const meta = selectedMonthMeta.value
  if (!meta) return ''
  return `${meta.name} ${meta.year}`
})

const daysInMonth = computed(() => {
  const month = selectedMonthMeta.value
  if (!month) return []
  return Array.from({ length: month.length }, (_, index) => index + 1)
})

const weekdayNames = computed(() => calendarView.value?.config?.weekdays.map((weekday) => weekday.name) || [])
const weekdayCount = computed(() => Math.max(1, weekdayNames.value.length))
const calendarGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${weekdayCount.value}, minmax(0, 1fr))`,
}))

const mod = (value: number, base: number) => ((value % base) + base) % base

const monthStartOffset = computed(() => {
  const config = calendarView.value?.config
  const month = selectedMonthMeta.value
  if (!config || !month) return 0

  const yearLength = config.months.reduce((sum, entry) => sum + entry.length, 0)
  const yearDelta = month.year - config.startingYear
  const daysFromYears = yearDelta * yearLength
  const daysBeforeMonth = config.months
    .slice(0, Math.max(0, month.month - 1))
    .reduce((sum, entry) => sum + entry.length, 0)

  return mod(config.firstWeekdayIndex + daysFromYears + daysBeforeMonth, weekdayCount.value)
})

const monthCells = computed(() => {
  const leadingEmptyCells = Array.from({ length: monthStartOffset.value }, () => null as number | null)
  return [...leadingEmptyCells, ...daysInMonth.value]
})

const currentDate = computed(() => calendarView.value?.currentDate || null)
const currentDateLabel = computed(() => {
  if (!currentDate.value) return 'Not configured'
  const monthName = selectedMonthMeta.value && currentDate.value.month === selectedMonthMeta.value.month
    ? selectedMonthMeta.value.name
    : `Month ${currentDate.value.month}`
  return `${monthName} ${currentDate.value.day}, Year ${currentDate.value.year}`
})

const sessionLookup = computed(() =>
  new Map((sessions.value || []).map((session) => [session.id, session])),
)

const allRangesWithSession = computed(() =>
  (sessionRanges.value || []).map((range) => ({
    ...range,
    session: sessionLookup.value.get(range.sessionId) || null,
  })),
)

type CalendarDate = { year: number, month: number, day: number }

const compareDate = (left: CalendarDate, right: CalendarDate) => {
  if (left.year !== right.year) return left.year - right.year
  if (left.month !== right.month) return left.month - right.month
  return left.day - right.day
}

const rangeIntersectsDay = (range: {
  startYear: number
  startMonth: number
  startDay: number
  endYear: number
  endMonth: number
  endDay: number
}, date: CalendarDate) => {
  const start = { year: range.startYear, month: range.startMonth, day: range.startDay }
  const end = { year: range.endYear, month: range.endMonth, day: range.endDay }
  return compareDate(start, date) <= 0 && compareDate(end, date) >= 0
}

const rangesInSelectedMonth = computed(() => {
  const month = selectedMonthMeta.value
  if (!month) return []

  const monthStart: CalendarDate = { year: month.year, month: month.month, day: 1 }
  const monthEnd: CalendarDate = { year: month.year, month: month.month, day: month.length }

  return allRangesWithSession.value.filter((range) => {
    const start: CalendarDate = { year: range.startYear, month: range.startMonth, day: range.startDay }
    const end: CalendarDate = { year: range.endYear, month: range.endMonth, day: range.endDay }
    return compareDate(end, monthStart) >= 0 && compareDate(start, monthEnd) <= 0
  })
})

const dayRangeCountMap = computed(() => {
  const map = new Map<number, number>()
  const month = selectedMonthMeta.value
  if (!month) return map

  for (let day = 1; day <= month.length; day += 1) {
    const count = rangesInSelectedMonth.value.filter((range) =>
      rangeIntersectsDay(range, { year: month.year, month: month.month, day }),
    ).length
    if (count > 0) {
      map.set(day, count)
    }
  }
  return map
})

const dayEventCountMap = computed(() => {
  const map = new Map<number, number>()
  for (const event of calendarView.value?.events || []) {
    map.set(event.day, (map.get(event.day) || 0) + 1)
  }
  return map
})

const eventModalOpen = ref(false)
const eventMode = ref<'create' | 'edit'>('create')
const eventForm = reactive({
  id: '',
  title: '',
  description: '',
  year: 1,
  month: 1,
  day: 1,
})
const eventAction = reactive({
  saving: false,
  deletingId: '',
  error: '',
})

const currentDateForm = reactive({
  year: 1,
  month: 1,
  day: 1,
})
const currentDateAction = reactive({
  saving: false,
  error: '',
  success: '',
})

const rangeForm = reactive({
  sessionId: '',
  startYear: 1,
  startMonth: 1,
  startDay: 1,
  endYear: 1,
  endMonth: 1,
  endDay: 1,
  includeEnd: false,
})
const rangeAction = reactive({
  saving: false,
  deleting: false,
  error: '',
  success: '',
})

const monthOptions = computed(() =>
  (calendarView.value?.config?.months || []).map((month, index) => ({
    label: `${index + 1}: ${month.name}`,
    value: index + 1,
  })),
)

const sessionOptions = computed(() =>
  (sessions.value || []).map((session) => ({
    label: `${session.sessionNumber ? `#${session.sessionNumber} ` : ''}${session.title}`,
    value: session.id,
  })),
)

const refreshAll = async () => {
  await Promise.all([refreshCalendarView(), refreshSessionRanges(), refreshSessions()])
}

const isInitialLoading = computed(() => {
  const calendarLoading = calendarPending.value && !calendarView.value
  const rangesLoading = sessionRangesPending.value && !sessionRanges.value
  const sessionsLoading = sessionsPending.value && !sessions.value
  return calendarLoading || rangesLoading || sessionsLoading
})

const clampSelectedDay = () => {
  const month = selectedMonthMeta.value
  if (!month) return
  if (selectedDay.value < 1) selectedDay.value = 1
  if (selectedDay.value > month.length) selectedDay.value = month.length
}

watch(
  () => calendarView.value,
  (value) => {
    if (!value?.config || !value.selectedMonth) return
    if (!selectedYear.value) selectedYear.value = value.selectedMonth.year
    if (!selectedMonth.value) selectedMonth.value = value.selectedMonth.month
    clampSelectedDay()
    currentDateForm.year = value.currentDate?.year || value.config.currentYear
    currentDateForm.month = value.currentDate?.month || value.config.currentMonth
    currentDateForm.day = value.currentDate?.day || value.config.currentDay
    if (selectedDay.value < 1 || selectedDay.value > value.selectedMonth.length) {
      selectedDay.value = value.currentDate?.day || 1
      clampSelectedDay()
    }
  },
  { immediate: true },
)

watch(
  () => [selectedYear.value, selectedMonth.value] as const,
  () => {
    clampSelectedDay()
  },
)

const shiftMonth = (direction: -1 | 1) => {
  const config = calendarView.value?.config
  if (!config || !selectedMonth.value) return
  const current = selectedMonth.value
  const next = current + direction
  if (next < 1) {
    selectedMonth.value = config.months.length
    selectedYear.value = (selectedYear.value || config.currentYear) - 1
    return
  }
  if (next > config.months.length) {
    selectedMonth.value = 1
    selectedYear.value = (selectedYear.value || config.currentYear) + 1
    return
  }
  selectedMonth.value = next
}

const jumpToDate = (date: CalendarDate) => {
  selectedYear.value = date.year
  selectedMonth.value = date.month
  selectedDay.value = date.day
}

const jumpToRangeStart = (range: {
  startYear: number
  startMonth: number
  startDay: number
}) => {
  jumpToDate({
    year: range.startYear,
    month: range.startMonth,
    day: range.startDay,
  })
}

const openCreateEvent = () => {
  if (!canEditCalendar.value || !selectedMonthMeta.value) return
  eventMode.value = 'create'
  eventAction.error = ''
  eventForm.id = ''
  eventForm.title = ''
  eventForm.description = ''
  eventForm.year = selectedMonthMeta.value.year
  eventForm.month = selectedMonthMeta.value.month
  eventForm.day = selectedDay.value
  eventModalOpen.value = true
}

const openEditEvent = (event: { id: string, title: string, description?: string | null, year: number, month: number, day: number }) => {
  if (!canEditCalendar.value) return
  eventMode.value = 'edit'
  eventAction.error = ''
  eventForm.id = event.id
  eventForm.title = event.title
  eventForm.description = event.description || ''
  eventForm.year = event.year
  eventForm.month = event.month
  eventForm.day = event.day
  eventModalOpen.value = true
}

const saveEvent = async () => {
  if (!canEditCalendar.value) return
  eventAction.error = ''
  eventAction.saving = true
  try {
    if (eventMode.value === 'create') {
      await calendarApi.createEvent(campaignId.value, {
        year: eventForm.year,
        month: eventForm.month,
        day: eventForm.day,
        title: eventForm.title,
        description: eventForm.description || undefined,
      })
    }
    else {
      await calendarApi.updateEvent(campaignId.value, eventForm.id, {
        year: eventForm.year,
        month: eventForm.month,
        day: eventForm.day,
        title: eventForm.title,
        description: eventForm.description || null,
      })
    }
    eventModalOpen.value = false
    await refreshCalendarView()
  }
  catch (error) {
    eventAction.error = (error as Error).message || 'Unable to save event.'
  }
  finally {
    eventAction.saving = false
  }
}

const deleteEvent = async (eventId: string) => {
  if (!canEditCalendar.value) return
  eventAction.deletingId = eventId
  eventAction.error = ''
  try {
    await calendarApi.deleteEvent(campaignId.value, eventId)
    await refreshCalendarView()
  }
  catch (error) {
    eventAction.error = (error as Error).message || 'Unable to delete event.'
  }
  finally {
    eventAction.deletingId = ''
  }
}

const applyCurrentDate = async () => {
  if (!canEditCalendar.value) return
  currentDateAction.error = ''
  currentDateAction.success = ''
  currentDateAction.saving = true
  try {
    await calendarApi.updateCurrentDate(campaignId.value, {
      year: currentDateForm.year,
      month: currentDateForm.month,
      day: currentDateForm.day,
    })
    currentDateAction.success = 'Current date updated.'
    await refreshCalendarView()
  }
  catch (error) {
    currentDateAction.error = (error as Error).message || 'Unable to update current date.'
  }
  finally {
    currentDateAction.saving = false
  }
}

const useSelectedDayAsCurrentDate = () => {
  if (!selectedMonthMeta.value) return
  currentDateForm.year = selectedMonthMeta.value.year
  currentDateForm.month = selectedMonthMeta.value.month
  currentDateForm.day = selectedDay.value
}

const loadRangeForSession = (sessionId: string) => {
  rangeAction.error = ''
  rangeAction.success = ''
  rangeForm.sessionId = sessionId
  const existing = (sessionRanges.value || []).find((range) => range.sessionId === sessionId)
  if (!existing) {
    const fallbackYear = selectedMonthMeta.value?.year || currentDate.value?.year || 1
    const fallbackMonth = selectedMonthMeta.value?.month || currentDate.value?.month || 1
    const fallbackDay = selectedDay.value || currentDate.value?.day || 1
    rangeForm.startYear = fallbackYear
    rangeForm.startMonth = fallbackMonth
    rangeForm.startDay = fallbackDay
    rangeForm.endYear = fallbackYear
    rangeForm.endMonth = fallbackMonth
    rangeForm.endDay = fallbackDay
    rangeForm.includeEnd = false
    return
  }
  rangeForm.startYear = existing.startYear
  rangeForm.startMonth = existing.startMonth
  rangeForm.startDay = existing.startDay
  rangeForm.endYear = existing.endYear
  rangeForm.endMonth = existing.endMonth
  rangeForm.endDay = existing.endDay
  rangeForm.includeEnd =
    existing.endYear !== existing.startYear
    || existing.endMonth !== existing.startMonth
    || existing.endDay !== existing.startDay
}

const saveRange = async () => {
  if (!canEditCalendar.value || !rangeForm.sessionId) return
  rangeAction.error = ''
  rangeAction.success = ''
  rangeAction.saving = true
  try {
    await calendarApi.upsertSessionRange(rangeForm.sessionId, {
      startYear: rangeForm.startYear,
      startMonth: rangeForm.startMonth,
      startDay: rangeForm.startDay,
      endYear: rangeForm.includeEnd ? rangeForm.endYear : undefined,
      endMonth: rangeForm.includeEnd ? rangeForm.endMonth : undefined,
      endDay: rangeForm.includeEnd ? rangeForm.endDay : undefined,
    })
    rangeAction.success = 'Session range saved.'
    await Promise.all([refreshSessionRanges(), refreshCalendarView()])
  }
  catch (error) {
    rangeAction.error = (error as Error).message || 'Unable to save session range.'
  }
  finally {
    rangeAction.saving = false
  }
}

const removeRange = async () => {
  if (!canEditCalendar.value || !rangeForm.sessionId) return
  rangeAction.error = ''
  rangeAction.success = ''
  rangeAction.deleting = true
  try {
    await calendarApi.deleteSessionRange(rangeForm.sessionId)
    rangeAction.success = 'Session range removed.'
    await Promise.all([refreshSessionRanges(), refreshCalendarView()])
  }
  catch (error) {
    rangeAction.error = (error as Error).message || 'Unable to remove session range.'
  }
  finally {
    rangeAction.deleting = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs uppercase tracking-[0.3em] text-dimmed">Calendar</p>
      <h1 class="mt-2 text-2xl font-semibold">Campaign calendar</h1>
      <p class="mt-2 text-sm text-muted">Track in-world dates, events, and session timeline coverage.</p>
    </div>

    <UAlert
      v-if="!canEditCalendar"
      color="warning"
      variant="subtle"
      title="Read-only access"
      description="You can view calendar data, but only owner and collaborators can edit."
    />

    <SharedResourceState
      :pending="isInitialLoading"
      :error="calendarError || sessionRangesError || sessionsError"
      :empty="false"
      error-message="Unable to load calendar view."
      @retry="refreshAll"
    >
      <template #loading>
        <div class="grid gap-4 lg:grid-cols-3">
          <UCard class="h-72 animate-pulse lg:col-span-2" />
          <UCard class="h-72 animate-pulse" />
        </div>
      </template>

      <UCard v-if="!isCalendarEnabled">
        <template #header>
          <h2 class="text-lg font-semibold">Fantasy calendar is disabled</h2>
        </template>
        <p class="text-sm text-muted">
          Enable and configure the calendar from Settings &gt; General to start tracking in-world dates.
        </p>
        <UButton class="mt-4" :to="`/campaigns/${campaignId}/settings`" variant="outline">
          Open Settings &gt; General
        </UButton>
      </UCard>

      <div v-else class="space-y-4">
        <UCard>
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">{{ yearMonthLabel }}</h2>
                <p class="text-sm text-muted">Current in-world date: {{ currentDateLabel }}</p>
              </div>
              <div class="flex items-center gap-2">
                <UButton size="xs" variant="outline" @click="shiftMonth(-1)">Prev month</UButton>
                <UButton size="xs" variant="outline" @click="shiftMonth(1)">Next month</UButton>
              </div>
            </div>
          </template>

          <div class="grid gap-2" :style="calendarGridStyle">
            <div
              v-for="(weekday, index) in weekdayNames"
              :key="`weekday-label-${index}`"
              class="rounded-md border border-default bg-muted/30 px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted"
            >
              {{ weekday }}
            </div>
            <template v-for="(cellDay, index) in monthCells" :key="`month-cell-${index}`">
              <div
                v-if="cellDay === null"
                class="min-h-24 rounded-md border border-transparent px-2 py-2"
              />
              <button
                v-else
                type="button"
                class="min-h-24 rounded-md border px-2 py-2 text-sm text-left transition flex flex-col items-start justify-start"
                :class="[
                  selectedDay === cellDay ? 'border-primary bg-primary/10' : 'border-default hover:bg-muted/40',
                  currentDate && currentDate.day === cellDay && currentDate.month === selectedMonthMeta?.month && currentDate.year === selectedMonthMeta?.year
                    ? 'ring-1 ring-primary'
                    : '',
                ]"
                @click="selectedDay = cellDay"
              >
                <div class="font-semibold">{{ cellDay }}</div>
                <div class="mt-1 flex flex-col items-start gap-1 text-[11px]">
                  <span v-if="dayRangeCountMap.get(cellDay)" class="text-primary">
                    {{ dayRangeCountMap.get(cellDay) }} Session{{ dayRangeCountMap.get(cellDay)! > 1 ? 's' : '' }}
                  </span>
                  <span
                    v-if="dayEventCountMap.get(cellDay)"
                    class="text-secondary"
                  >
                    {{ dayEventCountMap.get(cellDay) }} Event{{ dayEventCountMap.get(cellDay)! > 1 ? 's' : '' }}
                  </span>
                </div>
              </button>
            </template>
          </div>
        </UCard>

        <div class="grid gap-4 xl:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-semibold">Events: day {{ selectedDay }}</h3>
                <UButton
                  v-if="canEditCalendar"
                  size="xs"
                  variant="outline"
                  @click="openCreateEvent"
                >
                  Add event
                </UButton>
              </div>
            </template>

            <p v-if="eventAction.error" class="mb-2 text-sm text-error">{{ eventAction.error }}</p>

            <div v-if="!selectedDayRanges.length && !selectedDayEvents.length" class="text-sm text-muted">
              No events or session ranges for this day.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="range in selectedDayRanges"
                :key="`selected-day-range-${range.id}`"
                class="rounded-md border border-default p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-xs uppercase tracking-wide text-muted">Session range</p>
                    <p class="text-sm font-semibold">{{ range.session?.title || `Session ${range.sessionId}` }}</p>
                  </div>
                  <UButton size="xs" variant="outline" @click="jumpToRangeStart(range)">Go to start</UButton>
                </div>
              </div>
              <div
                v-for="event in selectedDayEvents"
                :key="event.id"
                class="rounded-md border border-default p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold">{{ event.title }}</p>
                    <p v-if="event.description" class="text-xs text-muted">{{ event.description }}</p>
                  </div>
                  <div v-if="canEditCalendar" class="flex items-center gap-1">
                    <UButton size="xs" variant="ghost" @click="openEditEvent(event)">Edit</UButton>
                    <UButton
                      size="xs"
                      color="error"
                      variant="ghost"
                      :loading="eventAction.deletingId === event.id"
                      @click="deleteEvent(event.id)"
                    >
                      Delete
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-semibold">Current date</h3>
            </template>

            <div class="space-y-3">
              <div class="grid gap-2 sm:grid-cols-3">
                <UInput v-model.number="currentDateForm.year" type="number" :disabled="!canEditCalendar" />
                <USelect
                  v-model="currentDateForm.month"
                  :items="monthOptions"
                  :disabled="!canEditCalendar"
                />
                <UInput
                  v-model.number="currentDateForm.day"
                  type="number"
                  min="1"
                  :max="selectedMonthMeta?.length || 1"
                  :disabled="!canEditCalendar"
                />
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  :disabled="!canEditCalendar"
                  :loading="currentDateAction.saving"
                  @click="applyCurrentDate"
                >
                  Update current date
                </UButton>
                <UButton
                  variant="ghost"
                  color="neutral"
                  :disabled="!canEditCalendar"
                  @click="useSelectedDayAsCurrentDate"
                >
                  Use selected day
                </UButton>
              </div>
              <p v-if="currentDateAction.error" class="text-sm text-error">{{ currentDateAction.error }}</p>
              <p v-if="currentDateAction.success" class="text-sm text-success">{{ currentDateAction.success }}</p>
            </div>
          </UCard>
        </div>
      </div>

      <UCard v-if="isCalendarEnabled" class="mt-4">
        <template #header>
          <h3 class="font-semibold">Session ranges</h3>
        </template>

        <div class="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div class="space-y-3">
            <p v-if="rangeAction.error" class="text-sm text-error">{{ rangeAction.error }}</p>
            <p v-if="rangeAction.success" class="text-sm text-success">{{ rangeAction.success }}</p>

            <USelect
              v-model="rangeForm.sessionId"
              :items="sessionOptions"
              placeholder="Select session"
              :disabled="!canEditCalendar"
              @update:model-value="(value) => loadRangeForSession(value as string)"
            />

            <div class="grid gap-2 sm:grid-cols-3">
              <UInput v-model.number="rangeForm.startYear" type="number" :disabled="!canEditCalendar" />
              <USelect v-model="rangeForm.startMonth" :items="monthOptions" :disabled="!canEditCalendar" />
              <UInput
                v-model.number="rangeForm.startDay"
                type="number"
                min="1"
                :max="selectedMonthMeta?.length || 1"
                :disabled="!canEditCalendar"
              />
            </div>

            <USwitch
              :model-value="rangeForm.includeEnd"
              label="Set explicit end date"
              :disabled="!canEditCalendar"
              @update:model-value="(value) => rangeForm.includeEnd = value"
            />

            <div v-if="rangeForm.includeEnd" class="grid gap-2 sm:grid-cols-3">
              <UInput v-model.number="rangeForm.endYear" type="number" :disabled="!canEditCalendar" />
              <USelect v-model="rangeForm.endMonth" :items="monthOptions" :disabled="!canEditCalendar" />
              <UInput
                v-model.number="rangeForm.endDay"
                type="number"
                min="1"
                :max="selectedMonthMeta?.length || 1"
                :disabled="!canEditCalendar"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton
                :disabled="!canEditCalendar || !rangeForm.sessionId"
                :loading="rangeAction.saving"
                @click="saveRange"
              >
                Save range
              </UButton>
              <UButton
                color="error"
                variant="ghost"
                :disabled="!canEditCalendar || !rangeForm.sessionId"
                :loading="rangeAction.deleting"
                @click="removeRange"
              >
                Remove range
              </UButton>
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-sm text-muted">Session ranges</p>
            <div v-if="!allRangesWithSession.length" class="text-sm text-muted">No session ranges configured.</div>
            <div v-else class="space-y-2">
              <div
                v-for="range in allRangesWithSession"
                :key="range.id"
                class="rounded-md border border-default p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">
                      {{ range.session?.title || `Session ${range.sessionId}` }}
                    </p>
                    <p class="text-xs text-muted">
                      {{ range.startYear }}-{{ range.startMonth }}-{{ range.startDay }}
                      <span class="px-2">→</span>
                      {{ range.endYear }}-{{ range.endMonth }}-{{ range.endDay }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <UButton
                      size="xs"
                      variant="outline"
                      @click="jumpToRangeStart(range)"
                    >
                      Go to start
                    </UButton>
                    <UButton
                      v-if="canEditCalendar"
                      size="xs"
                      variant="outline"
                      @click="loadRangeForSession(range.sessionId)"
                    >
                      Edit
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </SharedResourceState>

    <SharedEntityFormModal
      v-model:open="eventModalOpen"
      :title="eventMode === 'create' ? 'Create event' : 'Edit event'"
      :saving="eventAction.saving"
      :error="eventAction.error"
      :submit-label="eventMode === 'create' ? 'Create' : 'Save'"
      @submit="saveEvent"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="eventForm.title" />
      </UFormField>
      <div class="grid gap-2 sm:grid-cols-3">
        <UFormField label="Year" name="year">
          <UInput v-model.number="eventForm.year" type="number" />
        </UFormField>
        <UFormField label="Month" name="month">
          <USelect v-model="eventForm.month" :items="monthOptions" />
        </UFormField>
        <UFormField label="Day" name="day">
          <UInput v-model.number="eventForm.day" type="number" min="1" />
        </UFormField>
      </div>
      <UFormField label="Description" name="description">
        <UTextarea v-model="eventForm.description" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>
  </div>
</template>


