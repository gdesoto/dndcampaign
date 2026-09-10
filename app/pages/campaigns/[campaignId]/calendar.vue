<script setup lang="ts">
import { titledEntityFormSchema } from '~/utils/entity-form-schemas'
import { useCampaignCalendar } from '~/composables/useCampaignCalendar'
import CampaignListTemplate from '~/components/campaign/templates/CampaignListTemplate.vue'
import CalendarDateFields from '~/components/campaign/CalendarDateFields.vue'
import type { CampaignCalendarEvent } from '#shared/types/calendar'

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
const toast = useToast()

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
  gridTemplateColumns: `repeat(${weekdayCount.value}, minmax(6.5rem, 1fr))`,
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
  const monthName = calendarView.value?.config?.months[currentDate.value.month - 1]?.name || `Month ${currentDate.value.month}`
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

const daySessionMap = computed(() => {
  const map = new Map<number, SessionItem[]>()
  const month = selectedMonthMeta.value
  if (!month) return map

  for (let day = 1; day <= month.length; day += 1) {
    const sessionsForDay = rangesInSelectedMonth.value
      .filter((range) => rangeIntersectsDay(range, { year: month.year, month: month.month, day }))
      .map((range) => range.session)
      .filter((session): session is SessionItem => Boolean(session))
      .sort((left, right) => {
        const leftNumber = left.sessionNumber ?? Number.MAX_SAFE_INTEGER
        const rightNumber = right.sessionNumber ?? Number.MAX_SAFE_INTEGER
        if (leftNumber !== rightNumber) return leftNumber - rightNumber
        return left.title.localeCompare(right.title)
      })

    if (sessionsForDay.length > 0) {
      map.set(day, sessionsForDay)
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

const dayEventsMap = computed(() => {
  const map = new Map<number, CampaignCalendarEvent[]>()
  for (const event of calendarView.value?.events || []) {
    const events = map.get(event.day) || []
    events.push(event)
    map.set(event.day, events)
  }
  return map
})

const sessionTooltip = (session: SessionItem) =>
  `Session ${session.sessionNumber ?? '?'}: ${session.title}`
const eventTooltip = (day: number) => {
  const events = dayEventsMap.value.get(day) || []
  return `${events.length > 1 ? 'Events' : 'Event'}: ${events.map(event => event.title).join(', ')}`
}

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
const currentDateDraft = useEditorDraft(() => ({ ...currentDateForm }), value => Object.assign(currentDateForm, value))

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

const calendarMonths = computed(() => calendarView.value?.config?.months || [])
const isCurrentDay = (day: number) => currentDate.value?.day === day && currentDate.value.month === selectedMonthMeta.value?.month && currentDate.value.year === selectedMonthMeta.value?.year
const dayLabel = (day: number) => `${selectedMonthMeta.value?.name} ${day}, ${selectedMonthMeta.value?.year}${isCurrentDay(day) ? ', current date' : ''}, ${daySessionMap.value.get(day)?.length || 0} sessions, ${dayEventCountMap.value.get(day) || 0} events`

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
    currentDateDraft.sync({ year: value.currentDate?.year || value.config.currentYear, month: value.currentDate?.month || value.config.currentMonth, day: value.currentDate?.day || value.config.currentDay }, campaignId.value)
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
    throw error
  }
  finally {
    eventAction.deletingId = ''
  }
}

const deleteEditingEvent = async () => {
  if (eventMode.value !== 'edit' || !eventForm.id) return
  await deleteEvent(eventForm.id)
  eventModalOpen.value = false
}

const applyCurrentDate = async () => {
  if (!canEditCalendar.value || currentDateAction.saving || !currentDateDraft.dirty.value) return
  const submitted = currentDateDraft.snapshot()
  currentDateAction.error = ''
  currentDateAction.success = ''
  currentDateAction.saving = true
  try {
    await calendarApi.updateCurrentDate(campaignId.value, submitted)
    currentDateDraft.accept(submitted)
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
    const fallbackYear = currentDate.value?.year || selectedMonthMeta.value?.year || 1
    const fallbackMonth = currentDate.value?.month || selectedMonthMeta.value?.month || 1
    const fallbackDay = currentDate.value?.day || selectedDay.value || 1
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
  if (!canEditCalendar.value || !rangeForm.sessionId || rangeAction.saving || rangeAction.deleting) return
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
  if (!canEditCalendar.value || !rangeForm.sessionId || rangeAction.saving || rangeAction.deleting) return
  const previous = sessionRanges.value?.find(range => range.sessionId === rangeForm.sessionId)
  if (!previous) return
  const targetCampaignId = campaignId.value
  rangeAction.error = ''
  rangeAction.success = ''
  rangeAction.deleting = true
  try {
    await calendarApi.deleteSessionRange(rangeForm.sessionId)
    toast.add({ title: 'Session range removed', actions: [{ label: 'Undo', onClick: async () => {
      try {
        await calendarApi.upsertSessionRange(previous.sessionId, { startYear: previous.startYear, startMonth: previous.startMonth, startDay: previous.startDay, endYear: previous.endYear, endMonth: previous.endMonth, endDay: previous.endDay })
        if (campaignId.value === targetCampaignId) await Promise.all([refreshSessionRanges(), refreshCalendarView()])
      } catch { toast.add({ title: 'Unable to restore session range', color: 'error' }) }
    } }] })
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
  <CampaignListTemplate title="Calendar">
    <template #actions><UButton v-if="canEditCalendar && isCalendarEnabled" icon="i-lucide-plus" color="primary" variant="solid" @click="openCreateEvent">Add event</UButton></template>

    <SharedReadOnlyAlert
      v-if="!canEditCalendar"
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
          <h2 class=" type-section">Fantasy calendar is disabled</h2>
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
                <h2 class=" type-section">{{ yearMonthLabel }}</h2>
                <UButton v-if="currentDate" icon="i-lucide-calendar-check" color="neutral" variant="ghost" size="sm" @click="jumpToDate(currentDate)">{{ currentDateLabel }}</UButton>
              </div>
              <div class="flex items-center gap-2">
                <UTooltip text="Previous month"><UButton icon="i-lucide-chevron-left" aria-label="Previous month" variant="outline" :disabled="calendarPending" @click="shiftMonth(-1)" /></UTooltip>
                <UTooltip text="Next month"><UButton icon="i-lucide-chevron-right" aria-label="Next month" variant="outline" :disabled="calendarPending" @click="shiftMonth(1)" /></UTooltip>
              </div>
            </div>
          </template>

          <div class="overflow-x-auto" role="region" aria-label="Calendar month" tabindex="0"><div class="grid gap-2" :style="calendarGridStyle">
            <div
              v-for="(weekday, index) in weekdayNames"
              :key="`weekday-label-${index}`"
              class="rounded-md border border-default bg-muted/30 px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted"
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
                class="min-h-24 rounded-md border px-2 py-2 text-sm text-left transition flex flex-col items-start justify-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :aria-label="dayLabel(cellDay)" :aria-pressed="selectedDay === cellDay" :aria-current="isCurrentDay(cellDay) ? 'date' : undefined"
                :class="[
                  selectedDay === cellDay ? 'border-primary bg-primary/10' : 'border-default hover:bg-muted/40',
                  currentDate && currentDate.day === cellDay && currentDate.month === selectedMonthMeta?.month && currentDate.year === selectedMonthMeta?.year
                    ? 'ring-1 ring-primary'
                    : '',
                ]"
                @click="selectedDay = cellDay"
              >
                <div class="flex w-full items-center justify-between font-semibold tabular-nums">{{ cellDay }}<UIcon v-if="isCurrentDay(cellDay)" name="i-lucide-calendar-check" class="size-3 text-primary" aria-hidden="true" /></div>
                <div class="mt-1 flex flex-col items-start gap-1 text-xs">
                  <div
                    v-if="daySessionMap.get(cellDay)?.length"
                    class="flex flex-wrap items-center gap-1"
                  >
                    <UTooltip v-for="session in daySessionMap.get(cellDay)" :key="session.id" :text="sessionTooltip(session)">
                      <UBadge color="info" variant="soft" size="xs" class="gap-1">
                        <UIcon name="i-lucide-book-open" class="size-3" aria-hidden="true" />
                        {{ session.sessionNumber ?? '?' }}
                      </UBadge>
                    </UTooltip>
                  </div>
                  <UTooltip
                    v-if="dayEventCountMap.get(cellDay)"
                    :text="eventTooltip(cellDay)"
                  >
                    <UBadge color="warning" variant="soft" size="xs" class="gap-1">
                      <UIcon name="i-lucide-sparkles" class="size-3" aria-hidden="true" />
                      {{ dayEventCountMap.get(cellDay) }} Event{{ dayEventCountMap.get(cellDay)! > 1 ? 's' : '' }}
                    </UBadge>
                  </UTooltip>
                </div>
              </button>
            </template>
          </div></div>
          <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
            <UBadge color="info" variant="soft" size="xs" class="gap-1">
              <UIcon name="i-lucide-book-open" aria-hidden="true" />
              Session
            </UBadge>
            <UBadge color="warning" variant="soft" size="xs" class="gap-1">
              <UIcon name="i-lucide-sparkles" aria-hidden="true" />
              Event
            </UBadge>
            <UBadge color="primary" variant="outline" size="xs" class="gap-1">
              <UIcon name="i-lucide-calendar-check" aria-hidden="true" />
              Current date
            </UBadge>
          </div>
        </UCard>

        <div class="grid gap-4 xl:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <h2 class="type-section">{{ selectedMonthMeta?.name }} {{ selectedDay }}</h2>
                <USelect v-model="selectedDay" :items="daysInMonth.map(day => ({ label: `Day ${day}`, value: day }))" aria-label="Selected day" class="w-28 shrink-0" />
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
                class="border-b border-muted py-3 last:border-0"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-xs uppercase tracking-[0.08em] text-muted">Session range</p>
                    <p class="text-sm font-semibold">{{ range.session?.title || `Session ${range.sessionId}` }}</p>
                  </div>
                  <UButton size="xs" variant="outline" @click="jumpToRangeStart(range)">Go to start</UButton>
                </div>
              </div>
              <div
                v-for="event in selectedDayEvents"
                :key="event.id"
                class="border-b border-muted py-3 last:border-0"
              >
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="type-record flex items-center gap-2"><UIcon name="i-lucide-sparkles" class="size-4 shrink-0" aria-hidden="true" />{{ event.title }}</p>
                    <p v-if="event.description" class="text-xs text-muted">{{ event.description }}</p>
                  </div>
                  <div v-if="canEditCalendar" class="flex items-center gap-1">
                    <UTooltip text="Edit event"><UButton icon="i-lucide-pencil" :aria-label="`Edit ${event.title}`" variant="ghost" @click="openEditEvent(event)" /></UTooltip>
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <UCard v-if="canEditCalendar" variant="soft" class="bg-muted">
            <template #header>
              <h2 class="type-section">Current date</h2>
            </template>

            <div class="space-y-3">
              <CalendarDateFields v-model:year="currentDateForm.year" v-model:month="currentDateForm.month" v-model:day="currentDateForm.day" prefix="current" :months="calendarMonths" :disabled="!canEditCalendar || currentDateAction.saving" />
              <div class="flex flex-wrap items-center gap-2">
                <UButton
                  :disabled="!canEditCalendar || currentDateAction.saving || !currentDateDraft.dirty.value"
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
          <h2 class="type-section">Session ranges</h2>
        </template>

        <div class="grid gap-4" :class="canEditCalendar ? 'xl:grid-cols-[1.1fr_1fr]' : ''">
          <div v-if="canEditCalendar" class="space-y-3">
            <p v-if="rangeAction.error" class="text-sm text-error">{{ rangeAction.error }}</p>
            <p v-if="rangeAction.success" class="text-sm text-success">{{ rangeAction.success }}</p>

            <UFormField label="Session" name="sessionId"><USelect
              v-model="rangeForm.sessionId"
              :items="sessionOptions"
              placeholder="Select session"
              :disabled="!canEditCalendar"
              @update:model-value="(value) => loadRangeForSession(value as string)"
            /></UFormField>

            <fieldset class="space-y-2"><legend class="type-label">Start date</legend><CalendarDateFields v-model:year="rangeForm.startYear" v-model:month="rangeForm.startMonth" v-model:day="rangeForm.startDay" prefix="start" :months="calendarMonths" :disabled="!canEditCalendar || rangeAction.saving || rangeAction.deleting" /></fieldset>

            <USwitch
              :model-value="rangeForm.includeEnd"
              label="Set explicit end date"
              :disabled="!canEditCalendar"
              @update:model-value="(value) => rangeForm.includeEnd = value"
            />

            <fieldset v-if="rangeForm.includeEnd" class="space-y-2"><legend class="type-label">End date</legend><CalendarDateFields v-model:year="rangeForm.endYear" v-model:month="rangeForm.endMonth" v-model:day="rangeForm.endDay" prefix="end" :months="calendarMonths" :disabled="!canEditCalendar || rangeAction.saving || rangeAction.deleting" /></fieldset>

            <div class="flex flex-wrap gap-2">
              <UButton
                :disabled="!canEditCalendar || !rangeForm.sessionId || rangeAction.saving || rangeAction.deleting"
                :loading="rangeAction.saving"
                @click="saveRange"
              >
                Save range
              </UButton>
              <UButton
                v-if="sessionRanges?.some(range => range.sessionId === rangeForm.sessionId)"
                color="neutral"
                variant="ghost"
                :disabled="!canEditCalendar || !rangeForm.sessionId || rangeAction.saving || rangeAction.deleting"
                :loading="rangeAction.deleting"
                @click="removeRange"
              >
                Remove range
              </UButton>
            </div>
          </div>

          <div class="space-y-2">

            <div v-if="!allRangesWithSession.length" class="text-sm text-muted">No session ranges configured.</div>
            <div v-else class="space-y-2">
              <div
                v-for="range in allRangesWithSession"
                :key="range.id"
                class="border-b border-muted py-3 last:border-0"
              >
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="type-record">
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
                    <UTooltip v-if="canEditCalendar" text="Edit range"><UButton icon="i-lucide-pencil" :aria-label="`Edit range for ${range.session?.title || range.sessionId}`" variant="ghost" @click="loadRangeForSession(range.sessionId)" /></UTooltip>
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
      :schema="titledEntityFormSchema"
      :state="eventForm"
      :title="eventMode === 'create' ? 'Create event' : 'Edit event'"
      :saving="eventAction.saving"
      :error="eventAction.error"
      :submit-label="eventMode === 'create' ? 'Create' : 'Save'"
      :show-delete-action="eventMode === 'edit'"
      :delete-loading="eventAction.deletingId === eventForm.id"
      :delete-action="deleteEditingEvent" :record-name="eventForm.title" delete-message="This calendar event will be permanently deleted."
      @submit="saveEvent"
    >
      <UFormField label="Title" name="title">
        <UInput v-model="eventForm.title" />
      </UFormField>
      <CalendarDateFields v-model:year="eventForm.year" v-model:month="eventForm.month" v-model:day="eventForm.day" prefix="event" :months="calendarMonths" :disabled="eventAction.saving" />
      <UFormField label="Description" name="description">
        <UTextarea v-model="eventForm.description" :rows="3" />
      </UFormField>
    </SharedEntityFormModal>
  </CampaignListTemplate>
</template>
