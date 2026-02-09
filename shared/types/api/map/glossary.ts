import type { MapStageAction } from './common'

export type MapGlossaryConflictCandidateDto = {
  glossaryEntryId: string
  name: string
  type: 'PC' | 'NPC' | 'ITEM' | 'LOCATION'
  confidence: number
  reasons: string[]
}

export type MapGlossaryStageItemDto = {
  featureId: string
  featureName: string
  featureType: string
  suggestedGlossary: {
    type: 'LOCATION'
    name: string
    aliases?: string
    description: string
  }
  defaultAction: MapStageAction
  hasConflict: boolean
  conflictCandidates: MapGlossaryConflictCandidateDto[]
}

export type MapGlossaryStageResultDto = {
  mapId: string
  stagedAt: string
  items: MapGlossaryStageItemDto[]
}

export type MapGlossaryCommitResultDto = {
  mapId: string
  processed: number
  created: number
  linked: number
  merged: number
  skipped: number
}
