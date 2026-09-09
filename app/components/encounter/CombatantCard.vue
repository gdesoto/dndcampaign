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
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <h3 class=" type-record">{{ props.combatant.name }}</h3>
          <p class="text-xs text-muted">{{ props.combatant.side }} · {{ props.combatant.sourceType }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge :color="props.combatant.isDefeated ? 'error' : 'neutral'" variant="soft">
            {{ props.combatant.isDefeated ? 'Defeated' : 'Active' }}
          </UBadge>
          <SharedActionMenu :name="combatant.name" :items="actions" />
        </div>
      </div>
    </template>

    <div class="grid grid-cols-2 gap-2 text-sm">
      <p>HP: {{ props.combatant.currentHp ?? '-' }}/{{ props.combatant.maxHp ?? '-' }}</p>
      <p>Temp HP: {{ props.combatant.tempHp }}</p>
      <p>AC: {{ props.combatant.armorClass ?? '-' }}</p>
      <p>Speed: {{ props.combatant.speed ?? '-' }}</p>
    </div>
  </UCard>
</template>
