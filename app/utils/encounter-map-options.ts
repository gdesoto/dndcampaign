import { encounterMapGeneratorConfigSchema } from '#shared/schemas/encounter-map'
import type { EncounterMapGeneratorConfig, EncounterMapType } from '#shared/types/encounter-map'

export const encounterMapTypes = [
  { label: 'Dungeon', value: 'DUNGEON' as const, icon: 'i-lucide-castle', description: 'Connected chambers and passages.' },
  { label: 'Building', value: 'BUILDING' as const, icon: 'i-lucide-house', description: 'A shared footprint with adjoining rooms and stairs between floors.' },
  { label: 'Forest', value: 'FOREST' as const, icon: 'i-lucide-trees', description: 'Clearings, trails, trees, and natural cover.' },
]

export const encounterMapThemes: Record<EncounterMapType, string> = { DUNGEON: 'ruins', BUILDING: 'manor', FOREST: 'woodland' }

export const encounterMapSizes = [
  { label: 'Small · 30 × 30', value: 30 },
  { label: 'Medium · 40 × 40', value: 40 },
  { label: 'Large · 60 × 60', value: 60 },
]

export const encounterMapFlows = [
  { label: 'Direct route', value: 'LINEAR' as const, description: 'Entrance → challenge → objective → exit.' },
  { label: 'Branching exploration', value: 'BRANCHING' as const, description: 'Optional side areas around the main route.' },
  { label: 'Alternate routes', value: 'LOOP' as const, description: 'A second approach to the objective.' },
]

export const encounterMapScales = [
  { label: 'Single encounter', value: 'SINGLE' as const },
  { label: 'Encounter sequence', value: 'SEQUENCE' as const },
  { label: 'Exploration site', value: 'COMPLEX' as const },
]

export const encounterMapFloors = [1, 2, 3, 4].map(value => ({
  label: `${value} ${value === 1 ? 'floor' : 'floors'}`,
  value,
}))

export const randomEncounterMapSeed = () => `map-${Math.random().toString(36).slice(2, 10)}`

export const createEncounterMapConfig = (config: Partial<EncounterMapGeneratorConfig> = {}) => {
  const mapType = config.mapType || 'DUNGEON'
  return encounterMapGeneratorConfigSchema.parse({
    ...config,
    mapType,
    floorCount: mapType === 'BUILDING' ? config.floorCount || 1 : 1,
    theme: config.theme ?? encounterMapThemes[mapType],
    layout: { secretRoomChance: mapType === 'DUNGEON' ? 0.1 : 0, ...config.layout },
    doors: { secretDoorChance: mapType === 'DUNGEON' ? 0.08 : 0, ...config.doors },
  })
}
