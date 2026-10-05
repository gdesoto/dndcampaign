<script setup lang="ts">
import type { DungeonGeneratorConfigInput } from '#shared/schemas/dungeon'
import type { DungeonMapType } from '#shared/types/dungeon'
import { createEncounterMapConfig, encounterMapFloors, encounterMapFlows, encounterMapScales, encounterMapSizes, encounterMapTypes } from '~/utils/encounter-map-options'

const props = defineProps<{
  modelValue: DungeonGeneratorConfigInput
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: DungeonGeneratorConfigInput]
}>()

const update = (patch: Partial<DungeonGeneratorConfigInput>) => {
  if (props.disabled) return
  const next = { ...props.modelValue, ...patch }
  if (next.mapType !== 'BUILDING') next.floorCount = 1
  if (next.mapType !== 'BUILDING' || next.floorCount < 2) {
    next.verticalConnections = {
      ...next.verticalConnections,
      basement: false,
      staircases: 'SINGLE',
      ladders: false,
      balconies: false,
    }
  }
  if (next.floorCount < (next.verticalConnections.basement ? 3 : 2)) {
    next.verticalConnections = { ...next.verticalConnections, balconies: false }
  }
  emit('update:modelValue', next)
}
const changeType = (mapType: DungeonMapType) => {
  const preset = createEncounterMapConfig({ mapType })
  update({
    mapType,
    floorCount: 1,
    theme: preset.theme,
    layout: { ...props.modelValue.layout, secretRoomChance: preset.layout.secretRoomChance },
    doors: { ...props.modelValue.doors, secretDoorChance: preset.doors.secretDoorChance },
  })
}
const updateAccess = (patch: Partial<DungeonGeneratorConfigInput['accessPoints']>) => update({ accessPoints: { ...props.modelValue.accessPoints, ...patch } })
const updateTerrain = (patch: Partial<DungeonGeneratorConfigInput['tacticalTerrain']>) => update({ tacticalTerrain: { ...props.modelValue.tacticalTerrain, ...patch } })
const updateVertical = (patch: Partial<DungeonGeneratorConfigInput['verticalConnections']>) => update({ verticalConnections: { ...props.modelValue.verticalConnections, ...patch } })
const supportsFloors = computed(() => props.modelValue.mapType === 'BUILDING' && props.modelValue.floorCount >= 2)
const supportsBalconies = computed(() => supportsFloors.value && props.modelValue.floorCount >= (props.modelValue.verticalConnections.basement ? 3 : 2))
const selectedSize = computed(() => props.modelValue.width === props.modelValue.height && encounterMapSizes.some(item => item.value === props.modelValue.width) ? props.modelValue.width : undefined)

const advancedGroups = [
  { label: 'Access points', value: 'access', slot: 'access', icon: 'i-lucide-door-open' },
  { label: 'Tactical terrain', value: 'terrain', slot: 'terrain', icon: 'i-lucide-mountain' },
  { label: 'Vertical connections', value: 'vertical', slot: 'vertical', icon: 'i-lucide-arrow-up-down' },
]
const entranceCounts = [1, 2, 3].map(value => ({ label: String(value), value }))
const exitCounts = entranceCounts.slice(0, 2)
const entranceSides = [
  { label: 'Automatic', value: 'AUTO' as const },
  { label: 'North', value: 'NORTH' as const },
  { label: 'East', value: 'EAST' as const },
  { label: 'South', value: 'SOUTH' as const },
  { label: 'West', value: 'WEST' as const },
]
const coverOptions = [
  { label: 'None', value: 'NONE' as const },
  { label: 'Light', value: 'LIGHT' as const },
  { label: 'Heavy', value: 'HEAVY' as const },
]
const sightlineOptions = [
  { label: 'Open', value: 'OPEN' as const },
  { label: 'Mixed', value: 'MIXED' as const },
  { label: 'Broken', value: 'BROKEN' as const },
]
const staircaseOptions = [
  { label: 'One staircase', value: 'SINGLE' as const },
  { label: 'Two staircases', value: 'DUAL' as const },
]
</script>

<template>
  <div class="space-y-3">
    <UFormField label="Map type" :description="encounterMapTypes.find(item => item.value === modelValue.mapType)?.description">
      <USelect :model-value="modelValue.mapType" :items="encounterMapTypes" :disabled="disabled" aria-label="Map type" @update:model-value="changeType" />
    </UFormField>
    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Canvas size">
        <USelect :model-value="selectedSize" :items="encounterMapSizes" placeholder="Custom dimensions" :disabled="disabled" aria-label="Map size" @update:model-value="update({ width: $event, height: $event })" />
      </UFormField>
      <UFormField v-if="modelValue.mapType === 'BUILDING'" label="Floors" description="Includes the basement when enabled.">
        <USelect :model-value="modelValue.floorCount" :items="encounterMapFloors" :disabled="disabled" aria-label="Floor count" @update:model-value="update({ floorCount: $event })" />
      </UFormField>
    </div>
    <UFormField label="Encounter scale">
      <USelect :model-value="modelValue.encounterScale" :items="encounterMapScales" :disabled="disabled" aria-label="Encounter scale" @update:model-value="update({ encounterScale: $event })" />
    </UFormField>
    <UFormField label="Encounter flow" :description="encounterMapFlows.find(item => item.value === modelValue.encounterFlow)?.description">
      <USelect :model-value="modelValue.encounterFlow" :items="encounterMapFlows" :disabled="disabled" aria-label="Encounter flow" @update:model-value="update({ encounterFlow: $event })" />
    </UFormField>

    <UAccordion :items="advancedGroups" type="multiple">
      <template #access-body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Entrances">
              <USelect :model-value="modelValue.accessPoints.entrances" :items="entranceCounts" :disabled="disabled" aria-label="Entrances" @update:model-value="updateAccess({ entrances: $event })" />
            </UFormField>
            <UFormField label="Exits">
              <USelect :model-value="modelValue.accessPoints.exits" :items="exitCounts" :disabled="disabled" aria-label="Exits" @update:model-value="updateAccess({ exits: $event })" />
            </UFormField>
          </div>
          <UFormField label="Main entrance side">
            <USelect :model-value="modelValue.accessPoints.entranceSide" :items="entranceSides" :disabled="disabled" aria-label="Main entrance side" @update:model-value="updateAccess({ entranceSide: $event })" />
          </UFormField>
          <USwitch :model-value="modelValue.accessPoints.concealedEntrance" label="Concealed entrance" description="Adds one hidden approach." :disabled="disabled" @update:model-value="updateAccess({ concealedEntrance: $event })" />
        </div>
      </template>
      <template #terrain-body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Cover">
              <USelect :model-value="modelValue.tacticalTerrain.cover" :items="coverOptions" :disabled="disabled" aria-label="Cover" @update:model-value="updateTerrain({ cover: $event })" />
            </UFormField>
            <UFormField label="Sightlines">
              <USelect :model-value="modelValue.tacticalTerrain.sightlines" :items="sightlineOptions" :disabled="disabled" aria-label="Sightlines" @update:model-value="updateTerrain({ sightlines: $event })" />
            </UFormField>
          </div>
          <USwitch :model-value="modelValue.tacticalTerrain.elevation" label="Elevated positions" :disabled="disabled" @update:model-value="updateTerrain({ elevation: $event })" />
          <USwitch :model-value="modelValue.tacticalTerrain.difficultTerrain" label="Difficult terrain" :disabled="disabled" @update:model-value="updateTerrain({ difficultTerrain: $event })" />
          <USwitch :model-value="modelValue.tacticalTerrain.hazards" label="Environmental hazards" :disabled="disabled" @update:model-value="updateTerrain({ hazards: $event })" />
        </div>
      </template>
      <template #vertical-body>
        <div class="space-y-3">
          <template v-if="supportsFloors">
            <USwitch :model-value="modelValue.verticalConnections.basement" label="Basement" :disabled="disabled" @update:model-value="updateVertical({ basement: $event })" />
            <UFormField label="Staircases">
              <USelect :model-value="modelValue.verticalConnections.staircases" :items="staircaseOptions" :disabled="disabled" aria-label="Staircases" @update:model-value="updateVertical({ staircases: $event })" />
            </UFormField>
            <USwitch :model-value="modelValue.verticalConnections.ladders" label="Ladders" :disabled="disabled" @update:model-value="updateVertical({ ladders: $event })" />
            <USwitch v-if="supportsBalconies" :model-value="modelValue.verticalConnections.balconies" label="Balconies" :disabled="disabled" @update:model-value="updateVertical({ balconies: $event })" />
          </template>
          <p v-else class="text-xs text-muted">Select a building with at least two floors for interior connections.</p>
          <USwitch :model-value="modelValue.verticalConnections.bridges" label="Bridges" :disabled="disabled" @update:model-value="updateVertical({ bridges: $event })" />
        </div>
      </template>
    </UAccordion>
  </div>
</template>
