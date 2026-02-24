<script setup lang="ts">
import type { EncounterCreateInput } from '#shared/schemas/encounter'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  saving: boolean
  error?: string
  sessionOptions?: Array<{ label: string, value: string }>
  calendarEnabled?: boolean
}>()

const emit = defineEmits<{
  create: [payload: EncounterCreateInput]
}>()

const form = reactive<EncounterCreateInput>({
  name: '',
  type: 'COMBAT',
  visibility: 'SHARED',
  notes: '',
  sessionId: undefined,
  calendarYear: undefined,
  calendarMonth: undefined,
  calendarDay: undefined,
})

const submit = () => {
  const toOptionalInt = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : undefined
  const calendarYear = toOptionalInt(form.calendarYear)
  const calendarMonth = toOptionalInt(form.calendarMonth)
  const calendarDay = toOptionalInt(form.calendarDay)
  const hasCalendarDate
    = typeof calendarYear === 'number'
      || typeof calendarMonth === 'number'
      || typeof calendarDay === 'number'
  emit('create', {
    ...form,
    notes: form.notes || undefined,
    sessionId: form.sessionId || undefined,
    calendarYear: hasCalendarDate ? calendarYear : undefined,
    calendarMonth: hasCalendarDate ? calendarMonth : undefined,
    calendarDay: hasCalendarDate ? calendarDay : undefined,
  })
}
</script>

<template>
  <SharedEntityFormModal
    v-model:open="open"
    title="Create encounter"
    submit-label="Create"
    :saving="props.saving"
    :error="props.error"
    @submit="submit"
  >
    <UFormField label="Name">
      <UInput v-model="form.name" placeholder="Bandit ambush at the bridge" />
    </UFormField>

    <div class="grid gap-4 md:grid-cols-2">
      <UFormField label="Type">
        <USelect
          v-model="form.type"
          :items="[
            { label: 'Combat', value: 'COMBAT' },
            { label: 'Social', value: 'SOCIAL' },
            { label: 'Skill challenge', value: 'SKILL_CHALLENGE' },
            { label: 'Chase', value: 'CHASE' },
            { label: 'Hazard', value: 'HAZARD' },
          ]"
        />
      </UFormField>
      <UFormField label="Visibility">
        <USelect
          v-model="form.visibility"
          :items="[
            { label: 'Shared', value: 'SHARED' },
            { label: 'DM only', value: 'DM_ONLY' },
          ]"
        />
      </UFormField>
    </div>

    <UFormField label="Notes">
      <UTextarea v-model="form.notes" :rows="4" placeholder="Optional setup notes" />
    </UFormField>

    <UFormField label="Linked session">
      <USelect
        v-model="form.sessionId"
        :items="props.sessionOptions || []"
        placeholder="No linked session"
      />
    </UFormField>

    <UCard v-if="props.calendarEnabled" :ui="{ body: 'space-y-3 p-4' }">
      <div>
        <p class="text-sm font-medium">In-world calendar date</p>
        <p class="text-xs text-muted">Optional. Fill all three fields to link this encounter to the campaign calendar.</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-3">
        <UFormField label="Year">
          <UInput v-model.number="form.calendarYear" type="number" placeholder="1024" />
        </UFormField>
        <UFormField label="Month">
          <UInput v-model.number="form.calendarMonth" type="number" placeholder="4" />
        </UFormField>
        <UFormField label="Day">
          <UInput v-model.number="form.calendarDay" type="number" placeholder="18" />
        </UFormField>
      </div>
    </UCard>
    <UAlert
      v-else
      color="neutral"
      variant="soft"
      title="Calendar disabled"
      description="Enable the campaign calendar to link encounters to in-world dates."
    />
  </SharedEntityFormModal>
</template>
