<script setup lang="ts">
const props = defineProps<{
  summary: {
    rounds: number
    totalEvents: number
    totalDamage: number
    totalHealing: number
    defeatedCombatants: number
  } | null
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold">Encounter summary</h2>
    </template>

    <div v-if="props.summary" class="grid gap-2 text-sm md:grid-cols-2">
      <p>Rounds: {{ props.summary.rounds }}</p>
      <p>Total events: {{ props.summary.totalEvents }}</p>
      <p>Total damage: {{ props.summary.totalDamage }}</p>
      <p>Total healing: {{ props.summary.totalHealing }}</p>
      <p>Defeated combatants: {{ props.summary.defeatedCombatants }}</p>
    </div>
    <p v-else class="text-sm text-muted">Summary unavailable.</p>
  </UCard>
</template>
