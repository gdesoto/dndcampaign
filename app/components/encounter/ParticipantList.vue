<script setup lang="ts">
import type { EncounterCombatant } from '#shared/types/encounter'
import type { RecordAction } from '~/types/actions'
const props = defineProps<{
  participants: EncounterCombatant[]
  selectedId?: string
  activeId: string | null
  canEdit: boolean
  canSetTurn: boolean
  canOrder: boolean
  busy: boolean
  remove: (id: string) => Promise<unknown>
}>()
const emit = defineEmits<{
  select: [id: string]
  edit: [participant: EncounterCombatant]
  duplicate: [participant: EncounterCombatant]
  setTurn: [id: string]
  add: []
  move: [id: string, direction: -1 | 1]
  roll: [id: string]
  clearInitiative: [id: string]
}>()
const actions = (p: EncounterCombatant): RecordAction[] =>
  props.canEdit
    ? [
        {
          label: 'Edit',
          icon: 'i-lucide-pencil',
          action: () => emit('edit', p),
        },
        {
          label: 'Duplicate',
          icon: 'i-lucide-copy',
          action: () => emit('duplicate', p),
        },
        ...(props.canSetTurn && props.activeId !== p.id
          ? [
              {
                label: 'Set active turn',
                icon: 'i-lucide-play',
                action: () => emit('setTurn', p.id),
              },
            ]
          : []),
        {
          label: 'Remove',
          icon: 'i-lucide-trash-2',
          destructive: true,
          action: () => props.remove(p.id),
          confirmation: {
            message: `Remove ${p.name} and their conditions from this encounter? This cannot be undone.`,
            label: 'Remove',
          },
        },
      ]
    : []
</script>
<template>
  <UCard>
    <template #header
      ><div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="type-section">
          Participants <span class="text-muted">{{ participants.length }}</span>
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
          <UTooltip v-if="canEdit" text="Add participant">
            <UButton
              icon="i-lucide-user-round-plus"
              aria-label="Add participant"
              :disabled="busy"
              @click="emit('add')"
            />
          </UTooltip>
        </div></div
    ></template>
    <p v-if="!participants.length" class="text-sm text-muted">
      No participants yet. Add participants to prepare this encounter.
    </p>
    <ul
      v-else
      class="max-h-80 overflow-y-auto divide-y divide-default lg:max-h-[65vh]"
      aria-label="Encounter participants"
    >
      <li
        v-for="(p, index) in participants"
        :key="p.id"
        class="py-3"
        :class="p.id === selectedId ? 'bg-accented' : ''"
      >
        <div class="flex items-start gap-2 px-2">
          <div v-if="canOrder" class="flex shrink-0 flex-col gap-1">
            <UTooltip :text="`Move ${p.name} up`">
              <UButton
                icon="i-lucide-chevron-up"
                variant="ghost"
                color="neutral"
                size="xs"
                :aria-label="`Move ${p.name} up`"
                :disabled="busy || index === 0"
                @click="emit('move', p.id, -1)"
              />
            </UTooltip>
            <UTooltip :text="`Move ${p.name} down`">
              <UButton
                icon="i-lucide-chevron-down"
                variant="ghost"
                color="neutral"
                size="xs"
                :aria-label="`Move ${p.name} down`"
                :disabled="busy || index === participants.length - 1"
                @click="emit('move', p.id, 1)"
              />
            </UTooltip>
          </div>
          <div class="min-w-0 flex-1">
            <button
              class="w-full min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-primary"
              type="button"
              :aria-pressed="p.id === selectedId"
              :aria-label="`Select ${p.name}`"
              @click="emit('select', p.id)"
            >
              <span class="flex flex-wrap items-center gap-2"
                ><span class="type-record break-words">{{ p.name }}</span
                ><UBadge v-if="p.id === activeId" color="primary" variant="soft"
                  >Current turn</UBadge
                ><UBadge
                  :color="p.side === 'ENEMY' ? 'error' : p.side === 'ALLY' ? 'success' : 'neutral'"
                  variant="soft"
                  >{{
                    p.side === 'ALLY' ? 'Ally' : p.side === 'ENEMY' ? 'Enemy' : 'Neutral'
                  }}</UBadge
                ><UBadge v-if="p.isDefeated" color="error" variant="soft">Defeated</UBadge></span
              >
            </button>
            <div
              class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm tabular-nums"
            >
              <span class="inline-flex items-center gap-1">
                <span>Init {{ p.initiative ?? '-' }}</span>
                <UTooltip
                  v-if="canOrder"
                  :text="p.initiative == null ? 'Roll initiative' : 'Clear initiative'"
                >
                  <UButton
                    :icon="p.initiative == null ? 'i-lucide-dices' : 'i-lucide-eraser'"
                    variant="ghost"
                    color="neutral"
                    class="size-8 justify-center"
                    :aria-label="`${p.initiative == null ? 'Roll' : 'Clear'} initiative for ${p.name}`"
                    :disabled="busy"
                    @click="
                      p.initiative == null ? emit('roll', p.id) : emit('clearInitiative', p.id)
                    "
                  />
                </UTooltip>
              </span>
              <span>HP {{ p.currentHp ?? '-' }}/{{ p.maxHp ?? '-' }} <span v-if="p.tempHp > 0" class="text-info">(+{{ p.tempHp }} temp)</span></span>
              <span>AC {{ p.armorClass ?? '-' }}</span>
              <span>Speed {{ p.speed == null ? '-' : `${p.speed} ft` }}</span>
            </div>
          </div>
          <SharedActionMenu :name="p.name" :items="actions(p)" :disabled="busy" />
        </div>
      </li>
    </ul>
  </UCard>
</template>
