<script setup lang="ts">
const props = defineProps<{
  status: 'ALL' | 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
  type: 'ALL' | 'COMBAT' | 'SOCIAL' | 'SKILL_CHALLENGE' | 'CHASE' | 'HAZARD'
}>()

const emit = defineEmits<{
  'update:status': [value: typeof props.status]
  'update:type': [value: typeof props.type]
}>()

const statusOptions = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Planned', value: 'PLANNED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Abandoned', value: 'ABANDONED' },
]

const typeOptions = [
  { label: 'All types', value: 'ALL' },
  { label: 'Combat', value: 'COMBAT' },
  { label: 'Social', value: 'SOCIAL' },
  { label: 'Skill challenge', value: 'SKILL_CHALLENGE' },
  { label: 'Chase', value: 'CHASE' },
  { label: 'Hazard', value: 'HAZARD' },
]
</script>

<template>
  <UCard>
    <div class="grid gap-3 md:grid-cols-2">
      <UFormField label="Status">
        <USelect
          :model-value="status"
          :items="statusOptions"
          @update:model-value="emit('update:status', ($event || 'ALL') as typeof props.status)"
        />
      </UFormField>
      <UFormField label="Type">
        <USelect
          :model-value="type"
          :items="typeOptions"
          @update:model-value="emit('update:type', ($event || 'ALL') as typeof props.type)"
        />
      </UFormField>
    </div>
  </UCard>
</template>
