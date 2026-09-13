<script setup lang="ts">
const props = withDefaults(defineProps<{
  prefix: string
  months: { name: string; length: number }[]
  disabled?: boolean
}>(), { disabled: false })
const year = defineModel<number>('year', { required: true })
const month = defineModel<number>('month', { required: true })
const day = defineModel<number>('day', { required: true })
const options = computed(() => props.months.map((entry, index) => ({ label: entry.name, value: index + 1 })))
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-[1fr_2fr_1fr]">
    <UFormField label="Year" :name="`${prefix}Year`"><UInput v-model.number="year" type="number" class="w-full" :disabled="disabled" /></UFormField>
    <UFormField label="Month" :name="`${prefix}Month`"><USelect v-model="month" :items="options" class="w-full" :disabled="disabled" /></UFormField>
    <UFormField label="Day" :name="`${prefix}Day`"><UInput v-model.number="day" type="number" min="1" :max="months[month - 1]?.length || 1" class="w-full" :disabled="disabled" /></UFormField>
  </div>
</template>
