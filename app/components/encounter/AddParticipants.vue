<script setup lang="ts">
import { z } from 'zod'
import type { EncounterCombatantCreateInput } from '#shared/schemas/encounter'
import {
  encounterParticipantsAddSchema,
  encounterParticipantFormSchema,
} from '#shared/schemas/encounter'
import type { EncounterStatBlock } from '#shared/types/encounter'
const props = defineProps<{ campaignId: string; encounterId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { request } = useApi()
type Character = { id: string; status: string; character: { id: string; name: string } }
type Npc = { id: string; name: string; type: string }
const {
  data: sources,
  pending,
  error: sourceError,
  refresh,
} = await useAsyncData(
  () => `participant-sources-${props.campaignId}`,
  async () => {
    const [characters, npcs, blocks] = await Promise.all([
      request<Character[]>(`/api/campaigns/${props.campaignId}/characters`),
      request<Npc[]>(`/api/campaigns/${props.campaignId}/glossary`),
      request<EncounterStatBlock[]>(`/api/campaigns/${props.campaignId}/encounters/stat-blocks`),
    ])
    return { characters, npcs: (npcs || []).filter((p) => p.type === 'NPC'), blocks }
  },
)
const state = reactive({
  mode: 'pc',
  sourceIds: [] as string[],
  quantity: 1,
  side: 'ALLY' as 'ALLY' | 'ENEMY' | 'NEUTRAL',
})
const custom = ref({
  name: '',
  side: 'ENEMY' as 'ALLY' | 'ENEMY' | 'NEUTRAL',
  maxHp: null as number | null,
  currentHp: null as number | null,
  tempHp: 0,
  armorClass: null as number | null,
  speed: null as number | null,
  initiative: null as number | null,
  notes: '',
})
const draft = computed(() => ({ ...state, custom: custom.value }))
const schema = z
  .object({
    mode: z.string(),
    sourceIds: z.array(z.string()),
    quantity: z.number().int().min(1).max(50),
  })
  .superRefine((value, ctx) => {
    if (value.mode !== 'custom' && !value.sourceIds.length)
      ctx.addIssue({ code: 'custom', path: ['sourceIds'], message: 'Select at least one source.' })
    if (value.mode !== 'custom' && value.sourceIds.length * value.quantity > 50)
      ctx.addIssue({
        code: 'custom',
        path: ['quantity'],
        message: 'Add at most 50 participants at once.',
      })
    if (value.mode === 'custom') {
      const parsed = encounterParticipantFormSchema.safeParse(custom.value)
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  })
const items = computed(() =>
  state.mode === 'pc'
    ? (sources.value?.characters || [])
        .filter((p) => p.status === 'ACTIVE')
        .map((p) => ({ label: p.character.name, value: p.character.id }))
    : state.mode === 'npc'
      ? (sources.value?.npcs || []).map((p) => ({ label: p.name, value: p.id }))
      : (sources.value?.blocks || []).map((p) => ({ label: p.name, value: p.id })),
)
watch(
  () => state.mode,
  (mode) => {
    state.sourceIds = []
    state.side = mode === 'pc' ? 'ALLY' : 'ENEMY'
  },
)
const saving = ref(false)
const error = ref('')
const save = async () => {
  if (saving.value) return
  error.value = ''
  saving.value = true
  try {
    let participants: EncounterCombatantCreateInput[]
    if (state.mode === 'custom') {
      const fields = Object.fromEntries(
        Object.entries(encounterParticipantFormSchema.parse(custom.value)).map(([key, value]) => [
          key,
          value === null || value === '' ? undefined : value,
        ]),
      )
      participants = encounterParticipantsAddSchema.parse({
        participants: [{ ...fields, sourceType: 'CUSTOM', isHidden: false }],
      }).participants
    } else {
      participants = state.sourceIds.flatMap((id) =>
        Array.from({ length: state.quantity }, (_, index) => ({
          name: `${items.value.find((item) => item.value === id)?.label || 'Participant'}${state.quantity > 1 ? ` ${index + 1}` : ''}`,
          side: state.side,
          sourceType:
            state.mode === 'pc'
              ? ('CAMPAIGN_CHARACTER' as const)
              : state.mode === 'npc'
                ? ('GLOSSARY_ENTRY' as const)
                : ('CUSTOM' as const),
          ...(state.mode === 'pc'
            ? { sourceCampaignCharacterId: id }
            : state.mode === 'npc'
              ? { sourceGlossaryEntryId: id }
              : { sourceStatBlockId: id }),
          tempHp: 0,
          isHidden: false,
        })),
      )
    }
    await request(`/api/encounters/${props.encounterId}/combatants`, {
      method: 'POST',
      body: encounterParticipantsAddSchema.parse({ participants }),
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
    title="Add participants"
    submit-label="Add participants"
    :state="draft"
    :schema="schema"
    :saving="saving"
    :error="error"
    @submit="save"
  >
    <UFormField label="Source" name="mode"
      ><USelect
        v-model="state.mode"
        :items="[
          { label: 'Campaign PC', value: 'pc' },
          { label: 'NPC', value: 'npc' },
          { label: 'Saved stat block', value: 'statblock' },
          { label: 'Custom participant', value: 'custom' },
        ]"
        class="w-full"
    /></UFormField>
    <EncounterParticipantFields v-if="state.mode === 'custom'" v-model="custom" />
    <SharedResourceState
      v-else
      :pending="pending"
      :error="sourceError"
      :has-data="Boolean(sources)"
      :empty="!items.length"
      empty-message="No sources available. Choose another source or add a custom participant."
      error-message="Unable to load participant sources."
      @retry="refresh()"
    >
      <div class="space-y-4">
        <UFormField label="Participants" name="sourceIds" required
          ><USelectMenu
            v-model="state.sourceIds"
            :items="items"
            value-key="value"
            multiple
            class="w-full"
        /></UFormField>
        <UFormField label="Side" name="side"
          ><USelect
            v-model="state.side"
            :items="[
              { label: 'Ally', value: 'ALLY' },
              { label: 'Neutral', value: 'NEUTRAL' },
              { label: 'Enemy', value: 'ENEMY' },
            ]"
            class="w-full"
        /></UFormField>
        <UFormField label="Quantity per source" name="quantity"
          ><UInput v-model.number="state.quantity" type="number" :min="1" :max="50"
        /></UFormField>
        <p class="text-sm text-muted">
          Available HP, armor class, and speed are copied from the source.
        </p>
      </div>
    </SharedResourceState>
  </SharedEntityFormModal>
</template>
