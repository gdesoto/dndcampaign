<script setup lang="ts">
type ChecklistItem = {
  id: string
  label: string
  done: boolean
}

defineProps<{
  items: ChecklistItem[]
}>()
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h3 class="text-sm font-semibold">Session checklist</h3>
        <p class="text-xs text-muted">Track the workflow steps.</p>
      </div>
    </template>
    <div class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-2"
      >
        <UCheckbox v-model="item.done" />
        <span class="text-sm">{{ item.label }}</span>
      </div>
    </div>
  </UCard>
</template>
