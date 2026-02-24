<script setup lang="ts">
import type { EncounterTemplate } from '#shared/types/encounter'

const props = defineProps<{
  templates: EncounterTemplate[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  instantiate: [templateId: string]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold">Template picker</h2>
    </template>

    <div v-if="props.templates.length" class="space-y-2">
      <div v-for="template in props.templates" :key="template.id" class="flex items-center justify-between gap-3 rounded-md border border-default p-2">
        <div>
          <p class="font-medium">{{ template.name }}</p>
          <p class="text-xs text-muted">{{ template.type }} · {{ template.combatants.length }} entries</p>
        </div>
        <UButton size="sm" :disabled="props.disabled" @click="emit('instantiate', template.id)">Use</UButton>
      </div>
    </div>
    <p v-else class="text-sm text-muted">No encounter templates yet.</p>
  </UCard>
</template>