<script setup lang="ts">
import type { RecordAction } from '~/types/actions'
import type { EncounterCombatant } from '#shared/types/encounter'

const props = defineProps<{
  combatant: EncounterCombatant
  canWrite?: boolean
  deleteAction: (id: string) => Promise<unknown>
}>()

const emit = defineEmits<{
  edit: [combatantId: string]
}>()
const actions = computed<RecordAction[]>(() => props.canWrite ? [
  { label: 'Edit', icon: 'i-lucide-pencil', action: () => emit('edit', props.combatant.id) },
  { label: 'Remove from encounter', icon: 'i-lucide-trash-2', destructive: true, action: () => props.deleteAction(props.combatant.id), confirmation: { message: `Remove ${props.combatant.name} from this encounter? This cannot be undone.`, label: 'Remove' } },
] : [])
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="space-y-1">
          <h3 class="type-record break-words">{{ props.combatant.name }}</h3>
          <p class="text-xs text-muted">{{ props.combatant.side.charAt(0) + props.combatant.side.slice(1).toLowerCase() }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge :color="props.combatant.isDefeated ? 'error' : 'neutral'" variant="soft">
            {{ props.combatant.isDefeated ? 'Defeated' : 'Active' }}
          </UBadge>
          <SharedActionMenu :name="combatant.name" :items="actions" />
        </div>
      </div>
    </template>

    <UProgress v-if="typeof combatant.currentHp === 'number' && combatant.maxHp && combatant.maxHp > 0" :model-value="Math.max(0, combatant.currentHp)" :max="combatant.maxHp" :aria-label="`${combatant.name} hit points`" :color="combatant.isDefeated ? 'error' : 'success'" class="mb-3" />
    <div class="grid grid-cols-2 gap-2 font-mono text-sm tabular-nums">
      <p>HP: {{ props.combatant.currentHp ?? '-' }}/{{ props.combatant.maxHp ?? '-' }}</p>
      <p>Temp HP: {{ props.combatant.tempHp }}</p>
      <p>AC: {{ props.combatant.armorClass ?? '-' }}</p>
      <p>Speed: {{ props.combatant.speed ?? '-' }}</p>
    </div>
  </UCard>
</template>
