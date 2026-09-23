<script setup lang="ts">
const model = defineModel<{
  name: string
  side: 'ALLY' | 'ENEMY' | 'NEUTRAL'
  maxHp: number | null
  currentHp: number | null
  tempHp: number
  armorClass: number | null
  speed: number | null
  initiative: number | null
  notes: string
}>({ required: true })
</script>
<template>
  <UFormField name="name" label="Name" required
    ><UInput v-model="model.name" class="w-full"
  /></UFormField>
  <UFormField name="side" label="Side"
    ><USelect
      v-model="model.side"
      :items="[
        { label: 'Ally', value: 'ALLY' },
        { label: 'Neutral', value: 'NEUTRAL' },
        { label: 'Enemy', value: 'ENEMY' },
      ]"
      class="w-full"
  /></UFormField>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <UFormField
      v-for="field in [
        { key: 'maxHp', label: 'Max HP' },
        { key: 'currentHp', label: 'Current HP' },
        { key: 'tempHp', label: 'Temp HP' },
        { key: 'armorClass', label: 'Armor class' },
        { key: 'speed', label: 'Speed (ft)' },
        { key: 'initiative', label: 'Initiative' },
      ] as const"
      :key="field.key"
      :name="field.key"
      :label="field.label"
    >
      <UInput
        v-model.number="model[field.key]"
        type="number"
        :min="field.key === 'initiative' ? undefined : 0"
        class="w-full"
      />
    </UFormField>
  </div>
  <UFormField name="notes" label="Notes"
    ><UTextarea v-model="model.notes" class="w-full"
  /></UFormField>
</template>
