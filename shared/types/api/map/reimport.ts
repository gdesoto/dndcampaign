import type { MapReimportStrategy } from './common'

export type MapReimportDiffDto = {
  added: number
  removed: number
  changed: number
  impactedGlossaryLinks: number
}

export type MapReimportPreviewDto = {
  mapId: string
  mapName: string
  diff: MapReimportDiffDto
  availableStrategies: MapReimportStrategy[]
}
