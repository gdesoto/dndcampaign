<script setup lang="ts">
const props = defineProps<{
  value: string
  saving: boolean
  error: string
  updatedAtLabel: string
}>()

const emit = defineEmits<{
  'update:value': [value: string]
  save: []
}>()

const valueModel = computed({
  get: () => props.value,
  set: (value: string) => emit('update:value', value),
})
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-lg font-semibold">Current status</h2>
        <p class="text-sm text-muted">Update where the story left off.</p>
      </div>
    </template>
    <div class="space-y-4">
      <UTextarea v-model="valueModel" :rows="6" placeholder="Where did we last leave the party?" />
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-muted">Last updated: {{ updatedAtLabel }}</p>
        <UButton :loading="saving" @click="emit('save')">Save status</UButton>
      </div>
    </template>
  </UCard>
</template>
