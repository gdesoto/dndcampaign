<script setup lang="ts">
const props = defineProps<{
  canWrite: boolean
}>()

const emit = defineEmits<{
  advance: []
  rewind: []
  roll: [mode: 'ALL' | 'UNSET' | 'NON_PCS']
}>()

const rollItems = [
  [{
    label: 'Roll all',
    onSelect: () => emit('roll', 'ALL'),
  }],
  [{
    label: 'Roll unset initiatives',
    onSelect: () => emit('roll', 'UNSET'),
  }],
  [{
    label: 'Roll non-PCs',
    onSelect: () => emit('roll', 'NON_PCS'),
  }],
]
</script>

<template>
  <UCard>
    <div class="flex flex-wrap gap-2">
      <UDropdownMenu :items="rollItems">
        <UButton :disabled="!props.canWrite">Roll initiative</UButton>
      </UDropdownMenu>
      <UButton :disabled="!props.canWrite" variant="outline" @click="emit('rewind')">Previous turn</UButton>
      <UButton :disabled="!props.canWrite" @click="emit('advance')">Next turn</UButton>
    </div>
  </UCard>
</template>
