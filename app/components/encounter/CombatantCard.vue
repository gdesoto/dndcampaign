<script setup lang="ts">
import type { EncounterCombatant } from '#shared/types/encounter'

const props = defineProps<{
  combatant: EncounterCombatant
  canWrite?: boolean
  deleteAction: (id: string) => Promise<unknown>
}>()

const emit = defineEmits<{
  edit: [combatantId: string]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <h3 class="text-sm font-semibold">{{ props.combatant.name }}</h3>
          <p class="text-xs text-muted">{{ props.combatant.side }} · {{ props.combatant.sourceType }}</p>
        </div>
        <div class="flex items-center gap-2">
          <UBadge :color="props.combatant.isDefeated ? 'error' : 'neutral'" variant="soft">
            {{ props.combatant.isDefeated ? 'Defeated' : 'Active' }}
          </UBadge>
          <UButton v-if="props.canWrite" size="xs" variant="outline" @click="emit('edit', props.combatant.id)">Edit</UButton>
          <SharedConfirmActionPopover
            v-if="props.canWrite"
            trigger-label="Delete"
            trigger-color="neutral"
            trigger-variant="soft"
            :trigger-show-label="true"
            :message="`Remove ${props.combatant.name} from this encounter? This cannot be undone.`"
            confirm-label="Delete"
            :action="() => deleteAction(props.combatant.id)"
          />
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
