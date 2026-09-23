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
    <UFormField name="name" label="Condition" required
      ><UInput v-model="form.name" list="encounter-condition-presets" class="w-full" /><datalist
        id="encounter-condition-presets"
      >
        <option v-for="name in presets" :key="name" :value="name" /></datalist
    ></UFormField>
    <div class="grid grid-cols-2 gap-3">
      <UFormField name="duration" label="Duration"
        ><UInput v-model.number="form.duration" type="number" :min="0" /></UFormField
      ><UFormField name="remaining" label="Remaining"
        ><UInput v-model.number="form.remaining" type="number" :min="0"
      /></UFormField>
    </div>
    <UFormField name="tickTiming" label="Count down at"
      ><USelect
        v-model="form.tickTiming"
        :items="[
          { label: 'Participant turn start', value: 'TURN_START' },
          { label: 'Participant turn end', value: 'TURN_END' },
          { label: 'Round end', value: 'ROUND_END' },
        ]"
        class="w-full"
    /></UFormField>
    <UFormField name="source" label="Source"
      ><UInput v-model="form.source" class="w-full"
    /></UFormField>
    <UFormField name="notes" label="Notes"
      ><UTextarea v-model="form.notes" class="w-full"
    /></UFormField>
  </SharedEntityFormModal>
</template>
