export type EncounterStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'
export type EncounterType = 'COMBAT' | 'SOCIAL' | 'SKILL_CHALLENGE' | 'CHASE' | 'HAZARD'
export type EncounterVisibility = 'DM_ONLY' | 'SHARED'
export type EncounterSide = 'ALLY' | 'ENEMY' | 'NEUTRAL'
export type EncounterSourceType = 'CAMPAIGN_CHARACTER' | 'PLAYER_CHARACTER' | 'GLOSSARY_ENTRY' | 'CUSTOM'
export type ConditionTickTiming = 'TURN_START' | 'TURN_END' | 'ROUND_END'
export type EncounterEventType = 'ENCOUNTER' | 'TURN' | 'HP' | 'CONDITION' | 'NOTE' | 'SYSTEM'

export type EncounterSummary = {
  id: string
  campaignId: string
  sessionId?: string | null
  name: string
  type: EncounterType
  status: EncounterStatus
  visibility: EncounterVisibility
  currentRound: number
  currentTurnIndex: number
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type EncounterDateLink = {
  year?: number | null
  month?: number | null
  day?: number | null
}

export type EncounterCombatant = {
  id: string
  encounterId: string
  name: string
  side: EncounterSide
  sourceType: EncounterSourceType
  sourceCampaignCharacterId?: string | null
  sourcePlayerCharacterId?: string | null
  sourceGlossaryEntryId?: string | null
  sourceStatBlockId?: string | null
  initiative?: number | null
  sortOrder: number
  maxHp?: number | null
  currentHp?: number | null
  tempHp: number
  armorClass?: number | null
  speed?: number | null
  isConcentrating: boolean
  deathSaveSuccesses: number
  deathSaveFailures: number
  isDefeated: boolean
  isHidden: boolean
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type EncounterCondition = {
  id: string
  combatantId: string
  name: string
  duration?: number | null
  remaining?: number | null
  tickTiming: ConditionTickTiming
  source?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type EncounterEvent = {
  id: string
  encounterId: string
  eventType: EncounterEventType
  summary: string
  payload?: Record<string, unknown> | null
  createdByUserId?: string | null
  createdAt: string
}

export type EncounterDetail = EncounterSummary & {
  notes?: string | null
  calendarYear?: number | null
  calendarMonth?: number | null
  calendarDay?: number | null
  combatants: EncounterCombatant[]
  conditions: EncounterCondition[]
  events: EncounterEvent[]
}

export type EncounterTemplate = {
  id: string
  campaignId: string
  name: string
  type: EncounterType
  notes?: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  combatants: EncounterTemplateCombatant[]
}

export type EncounterTemplateCombatant = {
  id: string
  templateId: string
  name: string
  side: EncounterSide
  sourceType: EncounterSourceType
  sourceStatBlockId?: string | null
  maxHp?: number | null
  armorClass?: number | null
  speed?: number | null
  quantity: number
  sortOrder: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type EncounterStatBlock = {
  id: string
  campaignId: string
  name: string
  challengeRating?: string | null
  statBlockJson: Record<string, unknown>
  notes?: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export type EncounterSummaryReport = {
  encounterId: string
  rounds: number
  totalEvents: number
  totalDamage: number
  totalHealing: number
  defeatedCombatants: number
}

export type InitiativeLaneItem = {
  combatantId: string
  name: string
  side: EncounterSide
  initiative: number | null
  sortOrder: number
  isActive: boolean
  isDefeated: boolean
}

export type EncounterRuntimeBoard = {
  encounterId: string
  round: number
  activeCombatantId?: string | null
  initiativeLane: InitiativeLaneItem[]
  warnings: string[]
}