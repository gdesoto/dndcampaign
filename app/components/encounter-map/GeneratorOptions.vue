<script setup lang="ts">
import type { EncounterMapGeneratorConfigInput } from '#shared/schemas/encounter-map'
import type { EncounterMapType } from '#shared/types/encounter-map'
import {
  createEncounterMapConfig, encounterMapFloors, encounterMapFlows, encounterMapScales, encounterMapSizes,
  encounterMapThemes, encounterMapTypes, randomEncounterMapSeed,
} from '~/utils/encounter-map-options'

const props = defineProps<{
  modelValue: EncounterMapGeneratorConfigInput
  disabled?: boolean
  seedPlaceholder?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: EncounterMapGeneratorConfigInput]
}>()
const seed = defineModel<string | undefined>('seed')

const update = (patch: Partial<EncounterMapGeneratorConfigInput>) => {
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
const changeType = (mapType: EncounterMapType) => {
  const preset = createEncounterMapConfig({ mapType })
  const theme = props.modelValue.theme.trim()
  update({
    mapType,
    floorCount: 1,
    // Replace only the previous type's default theme; keep one the user wrote.
    theme: !theme || theme === encounterMapThemes[props.modelValue.mapType] ? preset.theme : props.modelValue.theme,
    layout: { ...props.modelValue.layout, secretRoomChance: preset.layout.secretRoomChance },
    doors: { ...props.modelValue.doors, secretDoorChance: preset.doors.secretDoorChance },
  })
}
const updateAccess = (patch: Partial<EncounterMapGeneratorConfigInput['accessPoints']>) => update({ accessPoints: { ...props.modelValue.accessPoints, ...patch } })
const updateTerrain = (patch: Partial<EncounterMapGeneratorConfigInput['tacticalTerrain']>) => update({ tacticalTerrain: { ...props.modelValue.tacticalTerrain, ...patch } })
const updateVertical = (patch: Partial<EncounterMapGeneratorConfigInput['verticalConnections']>) => update({ verticalConnections: { ...props.modelValue.verticalConnections, ...patch } })
const updateLayout = (patch: Partial<EncounterMapGeneratorConfigInput['layout']>) => update({ layout: { ...props.modelValue.layout, ...patch } })
const supportsFloors = computed(() => props.modelValue.mapType === 'BUILDING' && props.modelValue.floorCount >= 2)
const supportsBalconies = computed(() => supportsFloors.value && props.modelValue.floorCount >= (props.modelValue.verticalConnections.basement ? 3 : 2))
const isForest = computed(() => props.modelValue.mapType === 'FOREST')

const presetSize = (width: number, height: number) => width === height && encounterMapSizes.some(item => item.value === width)
const customSize = ref(!presetSize(props.modelValue.width, props.modelValue.height))
watch(() => [props.modelValue.width, props.modelValue.height] as const, ([width, height]) => {
  if (!presetSize(width, height)) customSize.value = true
})
const sizeItems = [...encounterMapSizes, { label: 'Custom dimensions', value: 0 }]
const selectedSize = computed(() => customSize.value ? 0 : props.modelValue.width)
const selectSize = (value: number) => {
  customSize.value = value === 0
  if (value) update({ width: value, height: value })
}

const roomSize = computed(() => [props.modelValue.layout.minRoomSize, props.modelValue.layout.maxRoomSize])
const updateRoomSize = (value: number[] | undefined) => {
  const [low = 3, high = 4] = value ?? []
  const minRoomSize = Math.min(low, 24)
  updateLayout({ minRoomSize, maxRoomSize: Math.max(high, minRoomSize + 1) })
}

type ChanceField = {
  key: string
  label: string
  group: 'layout' | 'doors' | 'content'
  field: string
  min: number
  max: number
  visible: boolean
}
const chanceFields = computed<ChanceField[]>(() => {
  const { mapType, encounterScale, tacticalTerrain } = props.modelValue
  return [
    {
      key: 'density', label: isForest.value ? 'Ambient cover density' : 'Room density', group: 'layout' as const, field: 'roomDensity', min: 0.02, max: 0.8,
      visible: (mapType === 'DUNGEON' && encounterScale !== 'SINGLE') || (mapType === 'FOREST' && tacticalTerrain.cover !== 'NONE'),
    },
    { key: 'doors', label: 'Door frequency', group: 'doors' as const, field: 'doorFrequency', min: 0, max: 1, visible: mapType === 'DUNGEON' },
    { key: 'secret-rooms', label: 'Secret room chance', group: 'layout' as const, field: 'secretRoomChance', min: 0, max: 1, visible: mapType === 'DUNGEON' },
    { key: 'secret-doors', label: 'Secret door chance', group: 'doors' as const, field: 'secretDoorChance', min: 0, max: 1, visible: mapType !== 'FOREST' },
    { key: 'traps', label: 'Trap density', group: 'content' as const, field: 'trapDensity', min: 0, max: 1, visible: true },
    { key: 'encounters', label: 'Encounter density', group: 'content' as const, field: 'encounterDensity', min: 0, max: 1, visible: true },
  ].filter(item => item.visible)
})
const chanceValue = (item: ChanceField) => (props.modelValue[item.group] as Record<string, number>)[item.field] ?? item.min
const updateChance = (item: ChanceField, value: number | undefined) => {
  if (value === undefined) return
  update({ [item.group]: { ...props.modelValue[item.group], [item.field]: value } })
}
const percent = (value: number) => `${Math.round(value * 100)}%`

const advancedGroups = computed(() => [
  ...(props.modelValue.mapType !== 'BUILDING' ? [{ label: 'Layout', value: 'layout', slot: 'layout' as const, icon: 'i-lucide-layout-grid' }] : []),
  { label: 'Doors and contents', value: 'contents', slot: 'contents' as const, icon: 'i-lucide-swords' },
  { label: 'Access points', value: 'access', slot: 'access' as const, icon: 'i-lucide-door-open' },
  { label: 'Tactical terrain', value: 'terrain', slot: 'terrain' as const, icon: 'i-lucide-mountain' },
  { label: 'Vertical connections', value: 'vertical', slot: 'vertical' as const, icon: 'i-lucide-arrow-up-down' },
])
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
const corridorOptions = [
  { label: 'Straight', value: 'STRAIGHT' as const },
  { label: 'Winding', value: 'WINDING' as const },
  { label: 'Mixed', value: 'MIXED' as const },
]
</script>

<template>
  <div class="space-y-3">
    <UFormField label="Map type" name="config.mapType" :description="encounterMapTypes.find(item => item.value === modelValue.mapType)?.description">
      <USelect :model-value="modelValue.mapType" :items="encounterMapTypes" :disabled="disabled" aria-label="Map type" class="w-full" @update:model-value="changeType" />
    </UFormField>
    <UFormField label="Content theme" name="config.theme" required>
      <UInput :model-value="modelValue.theme" :disabled="disabled" placeholder="ruins, manor, woodland…" class="w-full" @update:model-value="update({ theme: String($event) })" />
    </UFormField>
    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Canvas size" :class="modelValue.mapType === 'BUILDING' ? '' : 'col-span-2'">
        <USelect :model-value="selectedSize" :items="sizeItems" :disabled="disabled" aria-label="Map size" class="w-full" @update:model-value="selectSize" />
      </UFormField>
      <UFormField v-if="modelValue.mapType === 'BUILDING'" label="Floors" hint="Incl. basement">
        <USelect :model-value="modelValue.floorCount" :items="encounterMapFloors" :disabled="disabled" aria-label="Floor count" class="w-full" @update:model-value="update({ floorCount: $event })" />
      </UFormField>
      <template v-if="customSize">
        <UFormField label="Width" name="config.width">
          <UInputNumber :model-value="modelValue.width" :min="20" :max="400" :disabled="disabled" class="w-full" @update:model-value="update({ width: $event ?? 20 })" />
        </UFormField>
        <UFormField label="Height" name="config.height">
          <UInputNumber :model-value="modelValue.height" :min="20" :max="400" :disabled="disabled" class="w-full" @update:model-value="update({ height: $event ?? 20 })" />
        </UFormField>
      </template>
    </div>
    <UFormField label="Encounter scale">
      <USelect :model-value="modelValue.encounterScale" :items="encounterMapScales" :disabled="disabled" aria-label="Encounter scale" class="w-full" @update:model-value="update({ encounterScale: $event })" />
    </UFormField>
    <UFormField label="Encounter flow" :description="encounterMapFlows.find(item => item.value === modelValue.encounterFlow)?.description">
      <USelect :model-value="modelValue.encounterFlow" :items="encounterMapFlows" :disabled="disabled" aria-label="Encounter flow" class="w-full" @update:model-value="update({ encounterFlow: $event })" />
    </UFormField>
    <UFormField label="Seed" name="seed">
      <UFieldGroup class="w-full">
        <UInput v-model="seed" :disabled="disabled" :placeholder="seedPlaceholder || 'e.g. crypt-2026-03-14'" class="min-w-0 flex-1" />
        <UTooltip text="Random seed">
          <UButton icon="i-lucide-shuffle" color="neutral" variant="outline" aria-label="Random seed" :disabled="disabled" @click="seed = randomEncounterMapSeed()" />
        </UTooltip>
      </UFieldGroup>
    </UFormField>

    <UAccordion :items="advancedGroups" type="multiple">
      <template #layout-body>
        <div class="space-y-4">
          <UFormField :label="isForest ? 'Clearing size' : 'Room size'" :hint="`${modelValue.layout.minRoomSize}–${modelValue.layout.maxRoomSize} cells`" name="config.layout.maxRoomSize">
            <USlider :model-value="roomSize" :min="3" :max="36" :min-steps-between-thumbs="1" :disabled="disabled" :aria-label="isForest ? 'Clearing size' : 'Room size'" @update:model-value="updateRoomSize" />
          </UFormField>
          <template v-for="item in chanceFields.filter(field => field.group === 'layout')" :key="item.key">
            <UFormField :label="item.label" :hint="percent(chanceValue(item))">
              <USlider :model-value="chanceValue(item)" :min="item.min" :max="item.max" :step="0.01" :disabled="disabled" :aria-label="item.label" @update:model-value="updateChance(item, $event)" />
            </UFormField>
          </template>
          <UFormField v-if="modelValue.mapType === 'DUNGEON'" label="Corridor layout">
            <USelect :model-value="modelValue.layout.corridorStyle" :items="corridorOptions" :disabled="disabled" aria-label="Corridor layout" class="w-full" @update:model-value="updateLayout({ corridorStyle: $event })" />
          </UFormField>
        </div>
      </template>
      <template #contents-body>
        <div class="space-y-4">
          <template v-for="item in chanceFields.filter(field => field.group !== 'layout')" :key="item.key">
            <UFormField :label="item.label" :hint="percent(chanceValue(item))">
              <USlider :model-value="chanceValue(item)" :min="item.min" :max="item.max" :step="0.01" :disabled="disabled" :aria-label="item.label" @update:model-value="updateChance(item, $event)" />
            </UFormField>
          </template>
        </div>
      </template>
      <template #access-body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Entrances">
              <USelect :model-value="modelValue.accessPoints.entrances" :items="entranceCounts" :disabled="disabled" aria-label="Entrances" class="w-full" @update:model-value="updateAccess({ entrances: $event })" />
            </UFormField>
            <UFormField label="Exits">
              <USelect :model-value="modelValue.accessPoints.exits" :items="exitCounts" :disabled="disabled" aria-label="Exits" class="w-full" @update:model-value="updateAccess({ exits: $event })" />
            </UFormField>
          </div>
          <UFormField label="Main entrance side">
            <USelect :model-value="modelValue.accessPoints.entranceSide" :items="entranceSides" :disabled="disabled" aria-label="Main entrance side" class="w-full" @update:model-value="updateAccess({ entranceSide: $event })" />
          </UFormField>
          <USwitch :model-value="modelValue.accessPoints.concealedEntrance" label="Concealed entrance" description="Adds one hidden approach." :disabled="disabled" @update:model-value="updateAccess({ concealedEntrance: $event })" />
        </div>
      </template>
      <template #terrain-body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Cover">
              <USelect :model-value="modelValue.tacticalTerrain.cover" :items="coverOptions" :disabled="disabled" aria-label="Cover" class="w-full" @update:model-value="updateTerrain({ cover: $event })" />
            </UFormField>
            <UFormField label="Sightlines">
              <USelect :model-value="modelValue.tacticalTerrain.sightlines" :items="sightlineOptions" :disabled="disabled" aria-label="Sightlines" class="w-full" @update:model-value="updateTerrain({ sightlines: $event })" />
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
              <USelect :model-value="modelValue.verticalConnections.staircases" :items="staircaseOptions" :disabled="disabled" aria-label="Staircases" class="w-full" @update:model-value="updateVertical({ staircases: $event })" />
            </UFormField>
            <USwitch :model-value="modelValue.verticalConnections.ladders" label="Ladders" :disabled="disabled" @update:model-value="updateVertical({ ladders: $event })" />
            <USwitch v-if="supportsBalconies" :model-value="modelValue.verticalConnections.balconies" label="Balconies" :disabled="disabled" @update:model-value="updateVertical({ balconies: $event })" />
          </template>
          <p v-else class="text-xs text-muted">Floor connections need a building with two or more floors.</p>
          <USwitch :model-value="modelValue.verticalConnections.bridges" label="Bridges" :disabled="disabled" @update:model-value="updateVertical({ bridges: $event })" />
        </div>
      </template>
    </UAccordion>
  </div>
</template>
