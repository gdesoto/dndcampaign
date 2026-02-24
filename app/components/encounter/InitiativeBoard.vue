<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { EncounterCombatant } from '#shared/types/encounter'

const props = defineProps<{
  combatants: EncounterCombatant[]
  activeIndex: number
  canWrite: boolean
}>()

const emit = defineEmits<{
  select: [combatantId: string]
  move: [payload: { combatantId: string, direction: 'up' | 'down' }]
  manage: []
  setInitiative: [payload: { combatantId: string, initiative: number | null }]
}>()

const manualInitiative = reactive<Record<string, string>>({})
const editingInitiativeId = ref<string | null>(null)

const openInitiativeEditor = (combatantId: string, initiative: number | null) => {
  manualInitiative[combatantId] = typeof initiative === 'number' ? String(initiative) : ''
  editingInitiativeId.value = combatantId
}

const closeInitiativeEditor = (combatantId: string) => {
  if (editingInitiativeId.value === combatantId) {
    editingInitiativeId.value = null
  }
}

const applyManualInitiative = (combatantId: string) => {
  const rawValue = manualInitiative[combatantId]
  const raw = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim()
  if (!raw.length) {
    emit('setInitiative', { combatantId, initiative: null })
    closeInitiativeEditor(combatantId)
    return
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  emit('setInitiative', { combatantId, initiative: Math.trunc(value) })
  closeInitiativeEditor(combatantId)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-base font-semibold">Initiative board</h2>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{{ props.combatants.length }} combatants</span>
          <UButton size="xs" variant="outline" :disabled="!props.canWrite" @click="emit('manage')">Manage combatants</UButton>
        </div>
      </div>
    </template>

    <div class="space-y-2">
      <div
        v-for="(combatant, index) in props.combatants"
        :key="combatant.id"
        role="button"
        tabindex="0"
        class="flex w-full items-center justify-between rounded-md border p-2 text-left"
        :class="index === props.activeIndex ? 'border-primary bg-primary/5' : 'border-default'"
        :aria-disabled="!props.canWrite"
        @click="props.canWrite && emit('select', combatant.id)"
        @keydown.enter.prevent="props.canWrite && emit('select', combatant.id)"
        @keydown.space.prevent="props.canWrite && emit('select', combatant.id)"
      >
        <span class="font-medium">{{ index + 1 }}. {{ combatant.name }}</span>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1">
            <UButton
              size="xs"
              icon="i-lucide-chevron-up"
              variant="ghost"
              :disabled="!props.canWrite || index === 0"
              @click.stop="emit('move', { combatantId: combatant.id, direction: 'up' })"
            />
            <UButton
              size="xs"
              icon="i-lucide-chevron-down"
              variant="ghost"
              :disabled="!props.canWrite || index === props.combatants.length - 1"
              @click.stop="emit('move', { combatantId: combatant.id, direction: 'down' })"
            />
          </div>
          <UBadge variant="soft" :color="combatant.side === 'ENEMY' ? 'error' : combatant.side === 'ALLY' ? 'success' : 'neutral'">
            {{ combatant.side }}
          </UBadge>
          <div
            v-if="combatant.initiative === null || editingInitiativeId === combatant.id"
            class="flex items-center gap-1"
          >
            <UInput
              v-model="manualInitiative[combatant.id]"
              size="xs"
              type="number"
              class="w-20"
              :disabled="!props.canWrite"
              placeholder="Init"
              @click.stop
              @keydown.enter.prevent.stop="applyManualInitiative(combatant.id)"
            />
            <UButton
              size="xs"
              variant="outline"
              :disabled="!props.canWrite"
              @click.stop="applyManualInitiative(combatant.id)"
            >
              Set
            </UButton>
            <UButton
              v-if="combatant.initiative !== null"
              size="xs"
              variant="ghost"
              :disabled="!props.canWrite"
              @click.stop="closeInitiativeEditor(combatant.id)"
            >
              Cancel
            </UButton>
          </div>
          <UButton
            v-else
            size="xs"
            variant="ghost"
            :disabled="!props.canWrite"
            @click.stop="openInitiativeEditor(combatant.id, combatant.initiative ?? null)"
          >
            Init {{ combatant.initiative }}
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
