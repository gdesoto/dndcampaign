<script setup lang="ts">
import type {
  EncounterCombatant,
  EncounterCondition,
  EncounterDetail,
} from '#shared/types/encounter'
import type { RecordAction } from '~/types/actions'
import { buildEncounterSummary } from '#shared/utils/encounter-summary'
import { getEncounterActions, type EncounterLifecycleAction } from '#shared/utils/encounter-policy'
import { encounterDamageSchema } from '#shared/schemas/encounter'

definePageMeta({ layout: 'dashboard' })
const { route, campaignId, request, canWriteContent } = useCampaignPageContext()
const encounterId = computed(() => route.params.encounterId as string)
const api = useEncounterDetail()
const retained = useRetainedResource<EncounterDetail | null>(() => encounterId.value)
const {
  data: encounter,
  pending,
  error,
  refresh,
} = await useAsyncData(
  () => `encounter-${encounterId.value}`,
  () => retained.load(() => api.getEncounter(encounterId.value)),
  { default: retained.get },
)
retained.seed(encounter.value)
const toast = useToast()
const selectedId = ref<string>()
const ordered = computed(() =>
  [...(encounter.value?.combatants || [])].sort((a, b) => a.sortOrder - b.sortOrder),
)
const selected = computed(
  () => ordered.value.find((p) => p.id === selectedId.value) || ordered.value[0],
)
const conditions = computed(() =>
  (encounter.value?.conditions || []).filter((c) => c.combatantId === selected.value?.id),
)
const available = computed(() =>
  getEncounterActions(
    encounter.value?.status || 'PLANNED',
    ordered.value.length,
    canWriteContent.value,
  ),
)
const finished = computed(() => ['COMPLETED', 'ABANDONED'].includes(encounter.value?.status || ''))
const summary = computed(() => (encounter.value ? buildEncounterSummary(encounter.value) : null))
const busy = ref(false)
const actionError = ref('')
const tab = ref('participants')
const showAdd = ref(false)
const showEdit = ref(false)
const editing = ref<EncounterCombatant>()
const showCondition = ref(false)
const editingCondition = ref<EncounterCondition>()
const conditionParticipantId = ref('')
const note = ref('')
useUnsavedChanges(() => Boolean(note.value.trim()), busy)
const amount = ref<number | undefined>(undefined)
const amountError = ref('')
const templatesApi = useEncounterTemplates()
const {
  data: templates,
  pending: templatesPending,
  error: templatesError,
  refresh: refreshTemplates,
} = await useAsyncData(
  () => `encounter-workspace-templates-${campaignId.value}`,
  () => templatesApi.listTemplates(campaignId.value),
)
const selectedTemplateId = ref('')
const templateName = ref('')
const showDuplicate = ref(false)
const duplicateSource = ref<EncounterCombatant>()

const run = async (operation: () => Promise<unknown>, rethrow = false) => {
  if (busy.value) return
  busy.value = true
  actionError.value = ''
  try {
    await operation()
    await refresh()
    return true
  } catch (e) {
    actionError.value = (e as Error).message
    if (rethrow) throw e
    return false
  } finally {
    busy.value = false
  }
}
const transition = async (action: EncounterLifecycleAction) => {
  if (!available.value[action].allowed) return
  const previous = encounter.value?.status
  const id = encounterId.value
  const success = await run(() =>
    request(`/api/encounters/${id}`, { method: 'PATCH', body: { action } }),
  )
  if (!success || !previous) return
  const undo: EncounterLifecycleAction[] =
    previous === 'PLANNED'
      ? action === 'abandon'
        ? ['reopen', 'reset']
        : ['reset']
      : previous === 'ACTIVE'
        ? action === 'pause'
          ? ['resume']
          : ['reopen', 'resume']
        : previous === 'PAUSED'
          ? action === 'resume'
            ? ['pause']
            : ['reopen']
          : [previous === 'COMPLETED' ? 'complete' : 'abandon']
  toast.add({
    title: `Encounter ${encounter.value?.status.toLowerCase()}`,
    duration: 8000,
    actions: [
      {
        label: 'Undo',
        onClick: async () => {
          if (id !== encounterId.value) return
          await run(async () => {
            for (const reversal of undo)
              await request(`/api/encounters/${id}`, {
                method: 'PATCH',
                body: { action: reversal },
              })
          })
        },
      },
    ],
  })
}
const turn = (action: 'advance' | 'rewind' | 'set-active', combatantId?: string) =>
  run(() =>
    request(`/api/encounters/${encounterId.value}/turn`, {
      method: 'PATCH',
      body: { action, ...(combatantId ? { combatantId } : {}) },
    }),
  )
const roll = (mode: 'ALL' | 'UNSET' | 'NON_PCS', combatantId?: string) =>
  run(() =>
    request(`/api/encounters/${encounterId.value}/initiative`, {
      method: 'PATCH',
      body: { action: 'roll', mode, ...(combatantId ? { combatantId } : {}) },
    }),
  )
const clearInitiative = async (combatantId?: string) => {
  const id = encounterId.value
  const previous = ordered.value
    .filter((p) => p.initiative != null && (!combatantId || p.id === combatantId))
    .map((p) => ({ id: p.id, initiative: p.initiative }))
  if (!previous.length) return
  if (
    !(await run(() =>
      request(`/api/encounters/${id}/initiative`, {
        method: 'PATCH',
        body: { action: 'clear', ...(combatantId ? { combatantId } : {}) },
      }),
    ))
  )
    return
  toast.add({
    title: 'Initiative cleared',
    actions: [
      {
        label: 'Undo',
        onClick: () =>
          run(async () => {
            if (id !== encounterId.value) return
            for (const participant of previous)
              await request(`/api/encounters/${id}/combatants/${participant.id}`, {
                method: 'PATCH',
                body: { initiative: participant.initiative },
              })
          }),
      },
    ],
  })
}
const move = (id: string, direction: -1 | 1) => {
  const ids = ordered.value.map((p) => p.id)
  const index = ids.indexOf(id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= ids.length) return
  ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
  void run(() =>
    request(`/api/encounters/${encounterId.value}/initiative`, {
      method: 'PATCH',
      body: { action: 'reorder', combatantOrder: ids },
    }),
  )
}
const edit = (p: EncounterCombatant) => {
  editing.value = p
  showEdit.value = true
}
const duplicate = (p: EncounterCombatant) => {
  duplicateSource.value = p
  showDuplicate.value = true
}
const remove = async (id: string) => {
  await run(
    () =>
      request(`/api/encounters/${encounterId.value}/combatants/${id}`, {
        method: 'DELETE',
      }),
    true,
  )
}
const effect = async (action: 'damage' | 'heal') => {
  amountError.value = ''
  const parsed = encounterDamageSchema.safeParse({ amount: amount.value })
  if (!parsed.success) {
    amountError.value = 'Enter a whole number from 1 to 9999.'
    return
  }
  if (!selected.value) return
  const participantId = selected.value.id
  if (
    await run(() =>
      request(`/api/encounters/${encounterId.value}/combatants`, {
        method: 'PATCH',
        body: {
          action,
          participantIds: [participantId],
          amount: parsed.data.amount,
        },
      }),
    )
  )
    amount.value = undefined
}
const openCondition = (condition?: EncounterCondition) => {
  if (!selected.value) return
  editingCondition.value = condition
  conditionParticipantId.value = selected.value.id
  showCondition.value = true
}
const removeCondition = async (condition: EncounterCondition) => {
  const id = encounterId.value
  if (
    !(await run(
      () =>
        request(`/api/encounters/${id}/combatants`, {
          method: 'PATCH',
          body: {
            action: 'condition-remove',
            participantId: condition.combatantId,
            conditionId: condition.id,
          },
        }),
      true,
    ))
  )
    return
  toast.add({
    title: `${condition.name} removed`,
    duration: 8000,
    actions: [
      {
        label: 'Undo',
        onClick: () =>
          run(() =>
            request(`/api/encounters/${id}/combatants`, {
              method: 'PATCH',
              body: {
                action: 'condition-add',
                participantIds: [condition.combatantId],
                condition: {
                  name: condition.name,
                  duration: condition.duration ?? undefined,
                  remaining: condition.remaining ?? undefined,
                  tickTiming: condition.tickTiming,
                  source: condition.source ?? undefined,
                  notes: condition.notes ?? undefined,
                },
              },
            }),
          ),
      },
    ],
  })
}
const saved = async () => {
  await refresh()
  toast.add({ title: 'Participant saved', color: 'success' })
}
const addNote = async () => {
  if (!note.value.trim()) return
  const submitted = note.value.trim()
  if (await run(() => api.addNoteEvent(encounterId.value, submitted))) note.value = ''
}
const createFromTemplate = async () => {
  if (!selectedTemplateId.value || !templateName.value.trim()) return
  await run(async () => {
    const created = await templatesApi.instantiateTemplate(selectedTemplateId.value, {
      name: templateName.value.trim(),
      sessionId: encounter.value?.sessionId || undefined,
    })
    if (!created) throw new Error('The new encounter could not be loaded.')
    await navigateTo(`/campaigns/${campaignId.value}/encounters/${created.id}`)
  })
}
const lifecycleMenu = computed<RecordAction[]>(() => [
  ...(available.value.pause.allowed
    ? [
        {
          label: 'Pause',
          icon: 'i-lucide-pause',
          action: () => transition('pause'),
        },
      ]
    : []),
  ...(available.value.complete.allowed
    ? [
        {
          label: 'Complete encounter',
          icon: 'i-lucide-check',
          action: () => transition('complete'),
        },
      ]
    : []),
  ...(available.value.abandon.allowed
    ? [
        {
          label: 'Abandon encounter',
          icon: 'i-lucide-x',
          action: () => transition('abandon'),
        },
      ]
    : []),
  ...(available.value.reset.allowed
    ? [
        {
          label: 'Reset turn progress',
          icon: 'i-lucide-rotate-ccw',
          destructive: true,
          confirmation: {
            message:
              'Reset round and turn to the beginning and return to Planned? HP, conditions and history are preserved.',
            label: 'Reset turn progress',
          },
          action: async () => {
            await run(
              () =>
                request(`/api/encounters/${encounterId.value}`, {
                  method: 'PATCH',
                  body: { action: 'reset' },
                }),
              true,
            )
          },
        },
      ]
    : []),
  { label: 'Refresh', icon: 'i-lucide-refresh-cw', action: () => refresh() },
])
const primary = computed(() =>
  encounter.value?.status === 'PLANNED'
    ? { label: 'Start encounter', action: 'start' as const }
    : encounter.value?.status === 'PAUSED'
      ? { label: 'Resume', action: 'resume' as const }
      : finished.value
        ? { label: 'Reopen', action: 'reopen' as const }
        : null,
)
watch(encounterId, () => {
  selectedId.value = undefined
  tab.value = 'participants'
  actionError.value = ''
  amount.value = undefined
})
watch(selectedId, () => {
  amount.value = undefined
  amountError.value = ''
})
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  poll = setInterval(() => {
    if (!busy.value && !pending.value) void refresh()
  }, 5000)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})
</script>

<template>
  <UPage :aria-busy="pending">
    <SharedResourceState
      :pending="pending && !encounter"
      :error="error"
      :has-data="Boolean(encounter)"
      :empty="!encounter"
      error-message="Unable to load encounter."
      empty-message="Encounter not found."
      @retry="refresh()"
    >
      <template v-if="encounter">
        <CampaignPageHeader :title="encounter.name">
          <template #title-trailing>
            <span class="inline-flex size-5 shrink-0 self-center items-center justify-center">
              <span
                v-if="pending"
                role="status"
                aria-label="Refreshing encounter"
                class="inline-flex"
              >
                <UIcon
                  name="i-lucide-loader-circle"
                  class="size-4 text-muted motion-safe:animate-spin"
                  aria-hidden="true"
                />
              </span>
            </span>
          </template>
          <template #actions>
            <UButton
              :to="`/campaigns/${campaignId}/encounters`"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              >Encounters</UButton
            >
            <UButton
              v-if="primary && canWriteContent"
              color="primary"
              variant="solid"
              :disabled="busy || !available[primary.action].allowed"
              :loading="busy"
              @click="transition(primary.action)"
              >{{ primary.label }}</UButton
            >
            <UButton
              v-if="available.turn.allowed"
              color="primary"
              variant="solid"
              trailing-icon="i-lucide-arrow-right"
              :disabled="busy"
              :loading="busy"
              @click="turn('advance')"
              >Next turn</UButton
            >
            <SharedActionMenu :name="encounter.name" :items="lifecycleMenu" :disabled="busy" />
          </template>
        </CampaignPageHeader>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <UBadge
            :color="
              encounter.status === 'ACTIVE'
                ? 'success'
                : encounter.status === 'PAUSED'
                  ? 'warning'
                  : 'neutral'
            "
            variant="soft"
            >{{ encounter.status.charAt(0) + encounter.status.slice(1).toLowerCase() }}</UBadge
          >
          <span v-if="encounter.status !== 'PLANNED'" class="font-mono tabular-nums text-muted"
            >Round {{ encounter.currentRound }}</span
          >
          <span v-if="encounter.status === 'PAUSED'" class="text-muted"
            >Turn progression is paused. Participants can be corrected.</span
          >
          <span v-if="finished" class="text-muted">Final record. Reopen to make changes.</span>
          <span
            v-if="primary && canWriteContent && !available[primary.action].allowed"
            class="text-muted"
            >{{ available[primary.action].reason }}</span
          >
        </div>
        <SharedReadOnlyAlert
          v-if="!canWriteContent"
          description="Your role can inspect this encounter but cannot change it."
        />
        <UAlert v-if="actionError" color="error" :description="actionError" />
        <EncounterSummaryPanel v-if="finished" :summary="summary" />
        <UTabs
          v-model="tab"
          :ui="{
            leadingIcon: 'hidden sm:inline-flex',
            trigger: 'px-2 sm:px-3',
          }"
          :unmount-on-hide="false"
          :items="[
            {
              label: 'Participants',
              value: 'participants',
              slot: 'participants',
              icon: 'i-lucide-users',
            },
            {
              label: 'History',
              value: 'history',
              slot: 'history',
              icon: 'i-lucide-history',
            },
            {
              label: 'Settings',
              value: 'settings',
              slot: 'settings',
              icon: 'i-lucide-settings',
            },
          ]"
          variant="link"
        >
          <template #participants>
            <div class="space-y-4">
              <div v-if="available.turn.allowed" class="flex flex-wrap gap-2">
                <UButton
                  v-if="available.turn.allowed"
                  icon="i-lucide-arrow-left"
                  :disabled="
                    busy || (encounter.currentRound === 1 && encounter.currentTurnIndex === 0)
                  "
                  @click="turn('rewind')"
                  >Previous turn</UButton
                >
              </div>
              <div class="grid items-start gap-4 lg:grid-cols-5">
                <div class="min-w-0 lg:col-span-3">
                  <EncounterParticipantList
                    :participants="ordered"
                    :selected-id="selected?.id"
                    :active-id="encounter.activeParticipantId"
                    :can-edit="available.participants.allowed"
                    :can-set-turn="available.turn.allowed"
                    :can-order="available.initiative.allowed"
                    :busy="busy"
                    :remove="remove"
                    @select="selectedId = $event"
                    @edit="edit"
                    @duplicate="duplicate"
                    @set-turn="turn('set-active', $event)"
                    @add="showAdd = true"
                    @move="move"
                    @roll="roll('ALL', $event)"
                    @clear-initiative="clearInitiative"
                  >
                    <template #actions>
                      <UDropdownMenu
                        v-if="available.initiative.allowed"
                        :items="[
                          [
                            { label: 'Roll all', onSelect: () => roll('ALL') },
                            {
                              label: 'Roll unset',
                              onSelect: () => roll('UNSET'),
                            },
                            {
                              label: 'Roll NPCs',
                              onSelect: () => roll('NON_PCS'),
                            },
                          ],
                          [
                            {
                              label: 'Clear initiative',
                              icon: 'i-lucide-eraser',
                              disabled: !ordered.some((p) => p.initiative != null),
                              onSelect: () => clearInitiative(),
                            },
                          ],
                        ]"
                      >
                        <UButton icon="i-lucide-dices" label="Roll initiative" :disabled="busy" />
                      </UDropdownMenu>
                    </template>
                  </EncounterParticipantList>
                </div>
                <UCard class="min-w-0 lg:sticky lg:top-4 lg:col-span-2" variant="soft">
                  <template #header
                    ><div class="flex items-center justify-between gap-2">
                      <h2 class="type-section">
                        {{ selected?.name || 'Participant details' }}
                      </h2>
                      <UButton
                        v-if="selected && available.participants.allowed"
                        icon="i-lucide-pencil"
                        variant="ghost"
                        :aria-label="`Edit ${selected.name}`"
                        :disabled="busy"
                        @click="edit(selected)"
                      /></div
                  ></template>
                  <div v-if="selected" class="space-y-4">
                    <dl class="grid grid-cols-3 gap-3 font-mono text-sm tabular-nums">
                      <div>
                        <dt class="text-muted">HP</dt>
                        <dd>{{ selected.currentHp ?? '-' }}/{{ selected.maxHp ?? '-' }}</dd>
                      </div>
                      <div>
                        <dt class="text-muted">Temp HP</dt>
                        <dd>{{ selected.tempHp }}</dd>
                      </div>
                      <div>
                        <dt class="text-muted">AC</dt>
                        <dd>{{ selected.armorClass ?? '-' }}</dd>
                      </div>
                      <div>
                        <dt class="text-muted">Speed</dt>
                        <dd>{{ selected.speed ?? '-' }} ft</dd>
                      </div>
                      <div>
                        <dt class="text-muted">Initiative</dt>
                        <dd>{{ selected.initiative ?? '-' }}</dd>
                      </div>
                      <div>
                        <dt class="text-muted">Side</dt>
                        <dd>
                          {{
                            selected.side === 'ALLY'
                              ? 'Ally'
                              : selected.side === 'ENEMY'
                                ? 'Enemy'
                                : 'Neutral'
                          }}
                        </dd>
                      </div>
                    </dl>
                    <div
                      v-if="available.turn.allowed && encounter.activeParticipantId !== selected.id"
                    >
                      <UButton
                        icon="i-lucide-play"
                        :disabled="busy"
                        @click="turn('set-active', selected.id)"
                        >Set active turn</UButton
                      >
                    </div>
                    <div v-if="available.effects.allowed" class="space-y-2">
                      <UFormField label="HP amount" :error="amountError"
                        ><UInput
                          v-model.number="amount"
                          type="number"
                          :min="1"
                          :max="9999"
                          :disabled="busy || selected.currentHp == null"
                          @keydown.enter.prevent="effect('damage')"
                      /></UFormField>
                      <p v-if="selected.currentHp == null" class="text-sm text-muted">
                        Set current HP in Edit before applying damage or healing.
                      </p>
                      <div class="flex gap-2">
                        <UButton
                          :disabled="busy || selected.currentHp == null"
                          @click="effect('damage')"
                          >Damage</UButton
                        ><UButton
                          :disabled="busy || selected.currentHp == null"
                          @click="effect('heal')"
                          >Heal</UButton
                        >
                      </div>
                    </div>
                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <h3 class="type-record">Conditions</h3>
                        <UButton
                          v-if="available.conditions.allowed"
                          icon="i-lucide-plus"
                          variant="ghost"
                          aria-label="Add condition"
                          :disabled="busy"
                          @click="openCondition()"
                        />
                      </div>
                      <p v-if="!conditions.length" class="text-sm text-muted">No conditions.</p>
                      <div
                        v-for="condition in conditions"
                        :key="condition.id"
                        class="flex items-center justify-between gap-2 border-t border-default py-2"
                      >
                        <div>
                          <p class="text-sm">
                            {{ condition.name }}
                            <span v-if="condition.remaining === 0" class="text-muted"
                              >(expired)</span
                            >
                          </p>
                          <p v-if="condition.remaining != null" class="text-xs text-muted">
                            {{ condition.remaining }} remaining -
                            {{
                              condition.tickTiming === 'TURN_START'
                                ? 'Turn start'
                                : condition.tickTiming === 'TURN_END'
                                  ? 'Turn end'
                                  : 'Round end'
                            }}
                          </p>
                        </div>
                        <SharedActionMenu
                          v-if="available.conditions.allowed"
                          :name="condition.name"
                          :disabled="busy"
                          :items="[
                            {
                              label: 'Edit',
                              icon: 'i-lucide-pencil',
                              action: () => openCondition(condition),
                            },
                            {
                              label: 'Remove',
                              icon: 'i-lucide-trash-2',
                              action: () => removeCondition(condition),
                            },
                          ]"
                        />
                      </div>
                    </div>
                    <p v-if="selected.notes" class="whitespace-pre-wrap text-sm text-muted">
                      {{ selected.notes }}
                    </p>
                  </div>
                  <p v-else class="text-sm text-muted">Add a participant to view their details.</p>
                </UCard>
              </div>
            </div>
          </template>
          <template #history
            ><div class="space-y-4">
              <EncounterSummaryPanel v-if="!finished" :summary="summary" /><EncounterEventTimeline
                :events="encounter.events"
              /><UCard v-if="available.notes.allowed"
                ><UFormField label="Encounter note"
                  ><UTextarea v-model="note" :maxlength="500" class="w-full" /></UFormField
                ><UButton class="mt-3" :disabled="busy || !note.trim()" @click="addNote"
                  >Add note</UButton
                ></UCard
              >
            </div></template
          >
          <template #settings
            ><div class="space-y-4">
              <EncounterSettings
                :key="encounter.id"
                :encounter="encounter"
                :can-edit="available.edit.allowed"
                :can-write="canWriteContent"
                @saved="refresh()"
              /><UCard v-if="canWriteContent"
                ><template #header><h2 class="type-section">Create another encounter</h2></template
                ><SharedResourceState
                  :pending="templatesPending"
                  :error="templatesError"
                  :has-data="Boolean(templates)"
                  :empty="!templates?.length"
                  empty-message="No encounter templates yet."
                  @retry="refreshTemplates()"
                  ><div class="space-y-3">
                    <UFormField label="Template"
                      ><USelect
                        v-model="selectedTemplateId"
                        :items="
                          (templates || []).map((t) => ({
                            label: t.name,
                            value: t.id,
                          }))
                        "
                        class="w-full" /></UFormField
                    ><UFormField label="New encounter name"
                      ><UInput v-model="templateName" class="w-full" /></UFormField
                    ><UButton
                      :disabled="busy || !selectedTemplateId || !templateName.trim()"
                      @click="createFromTemplate"
                      >Create encounter from template</UButton
                    >
                  </div></SharedResourceState
                ></UCard
              >
            </div></template
          >
        </UTabs>
        <EncounterAddParticipants
          v-if="showAdd"
          v-model:open="showAdd"
          :campaign-id="campaignId"
          :encounter-id="encounterId"
          @saved="saved"
        />
        <EncounterParticipantEditor
          v-if="editing"
          :key="editing.id"
          v-model:open="showEdit"
          :participant="editing"
          :encounter-id="encounterId"
          @saved="saved"
        />
        <EncounterParticipantEditor
          v-if="showDuplicate && duplicateSource"
          v-model:open="showDuplicate"
          duplicate
          :participant="duplicateSource"
          :encounter-id="encounterId"
          @saved="saved"
        />
        <EncounterConditionEditor
          v-if="showCondition"
          v-model:open="showCondition"
          :encounter-id="encounterId"
          :participant-id="conditionParticipantId"
          :condition="editingCondition"
          @saved="refresh()"
        />
      </template>
    </SharedResourceState>
  </UPage>
</template>
