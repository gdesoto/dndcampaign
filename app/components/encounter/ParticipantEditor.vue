<script setup lang="ts">
import type { EncounterCombatant } from '#shared/types/encounter'
import {
  encounterParticipantFormSchema,
  encounterCombatantCreateSchema,
} from '#shared/schemas/encounter'
const props = defineProps<{
  participant: EncounterCombatant
  encounterId: string
  duplicate?: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const api = useEncounterRuntime()
const saving = ref(false)
const error = ref('')
const form = ref({
  name: '',
  side: 'ENEMY' as EncounterCombatant['side'],
  maxHp: null as number | null,
  currentHp: null as number | null,
  tempHp: 0,
  armorClass: null as number | null,
  speed: null as number | null,
  initiative: null as number | null,
  notes: '',
})
const schema = encounterParticipantFormSchema
watch(
  open,
  (value) => {
    if (!value) return
    const p = props.participant
    form.value = {
      name: props.duplicate ? `${p.name} Copy` : p.name,
      side: p.side,
      maxHp: p.maxHp ?? null,
      currentHp: p.currentHp ?? null,
      tempHp: p.tempHp,
      armorClass: p.armorClass ?? null,
      speed: p.speed ?? null,
      initiative: p.initiative ?? null,
      notes: p.notes || '',
    }
    error.value = ''
  },
  { immediate: true },
)
const save = async () => {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const input = schema.parse(form.value)
    if (props.duplicate) {
      const p = props.participant
      await api.createCombatant(
        props.encounterId,
        encounterCombatantCreateSchema.parse({
          ...input,
          maxHp: input.maxHp ?? undefined,
          currentHp: input.currentHp ?? undefined,
          armorClass: input.armorClass ?? undefined,
          speed: input.speed ?? undefined,
          initiative: input.initiative ?? undefined,
          sourceType: p.sourceType,
          sourceCampaignCharacterId: p.sourceCampaignCharacterId ?? undefined,
          sourcePlayerCharacterId: p.sourcePlayerCharacterId ?? undefined,
          sourceGlossaryEntryId: p.sourceGlossaryEntryId ?? undefined,
          sourceStatBlockId: p.sourceStatBlockId ?? undefined,
        }),
      )
    } else await api.updateCombatant(props.encounterId, props.participant.id, input)
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
    :title="duplicate ? 'Duplicate participant' : 'Edit participant'"
    :submit-label="duplicate ? 'Add participant' : 'Save'"
    :state="form"
    :schema="schema"
    :saving="saving"
    :error="error"
    @submit="save"
  >
    <EncounterParticipantFields v-model="form" />
  </SharedEntityFormModal>
</template>
