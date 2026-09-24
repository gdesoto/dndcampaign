<script setup lang="ts">
import { z } from 'zod'
import type { EncounterCondition } from '#shared/types/encounter'
import {
  encounterConditionUpdateSchema,
  encounterConditionCreateSchema,
} from '#shared/schemas/encounter'
const props = defineProps<{
  encounterId: string
  participantId: string
  condition?: EncounterCondition
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { request } = useApi()
const saving = ref(false)
const error = ref('')
const form = reactive({
  name: props.condition?.name || '',
  duration: props.condition?.duration ?? null,
  remaining: props.condition?.remaining ?? null,
  tickTiming: props.condition?.tickTiming || 'TURN_END',
  source: props.condition?.source || '',
  notes: props.condition?.notes || '',
})
const nullableNumber = z.preprocess(
  (value) => (value === '' ? null : value),
  z.number().int().min(0).nullable(),
)
const schema = z.object({
  ...encounterConditionUpdateSchema.shape,
  name: z.string().trim().min(1).max(120),
  duration: nullableNumber,
  remaining: nullableNumber,
})
const presets = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious',
]
const conditionChoice = ref(form.name && !presets.includes(form.name) ? '__custom' : form.name)
const customCondition = computed(() => conditionChoice.value === '__custom')
watch(conditionChoice, value => {
  form.name = value === '__custom' ? '' : value
})
const conditionOptions = [...presets.map(name => ({ label: name, value: name })), { label: 'Custom condition…', value: '__custom' }]
const save = async () => {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const changes = schema.parse(form)
    const body = props.condition
      ? {
          action: 'condition-update',
          participantId: props.participantId,
          conditionId: props.condition.id,
          changes,
        }
      : {
          action: 'condition-add',
          participantIds: [props.participantId],
          condition: encounterConditionCreateSchema.parse({
            ...changes,
            duration: changes.duration ?? undefined,
            remaining: changes.remaining ?? undefined,
          }),
        }
    await request(`/api/encounters/${props.encounterId}/combatants`, {
      method: 'PATCH',
      body,
    })
    open.value = false
    emit('saved')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <SharedEntityFormModal
    v-model:open="open"
    :title="condition ? 'Edit condition' : 'Add condition'"
    :state="form"
    :schema="schema"
    :saving="saving"
    :error="error"
    @submit="save"
  >
    <UFormField :name="customCondition ? undefined : 'name'" label="Condition" required>
      <USelectMenu v-model="conditionChoice" :items="conditionOptions" value-key="value" placeholder="Select a condition" class="w-full" />
    </UFormField>
    <UFormField v-if="customCondition" name="name" label="Custom condition" required>
      <UInput v-model="form.name" placeholder="e.g. Marked by the hunter" :maxlength="120" class="w-full" />
    </UFormField>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <UFormField name="duration" label="Duration" hint="Rounds">
        <UInputNumber v-model="form.duration" :min="0" :step="1" placeholder="Unlimited" class="w-full" />
      </UFormField>
      <UFormField name="remaining" label="Remaining" hint="Rounds">
        <UInputNumber v-model="form.remaining" :min="0" :step="1" :placeholder="condition ? 'Unlimited' : 'Use duration'" class="w-full" />
      </UFormField>
      <UFormField name="tickTiming" label="Count down at" class="sm:col-span-2">
        <USelect
          v-model="form.tickTiming" :items="[
          { label: 'Participant turn start', value: 'TURN_START' },
          { label: 'Participant turn end', value: 'TURN_END' },
          { label: 'Round end', value: 'ROUND_END' },
        ]" class="w-full" />
      </UFormField>
    </div>
    <UFormField name="source" label="Source">
      <UInput v-model="form.source" placeholder="e.g. Hold Person — enemy mage" class="w-full" />
    </UFormField>
    <UFormField name="notes" label="Notes"
      ><UTextarea v-model="form.notes" class="w-full"
    /></UFormField>
  </SharedEntityFormModal>
</template>
