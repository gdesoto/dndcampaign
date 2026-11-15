import { eq } from 'drizzle-orm'
import type { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { apiError } from '#server/utils/http'
import { EXHAUSTION_MAX_LEVEL, isExhaustion } from '#shared/utils/encounter-policy'

type Connection = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

// Exhaustion uses remaining as its level, never as a round counter.
export function conditionCounters(input: { name: string; duration?: number | null; remaining?: number | null }) {
  if (!isExhaustion(input.name)) return { duration: input.duration, remaining: input.remaining ?? input.duration }
  const level = input.remaining ?? 1
  if (level < 1 || level > EXHAUSTION_MAX_LEVEL) {
    throw apiError(400, 'VALIDATION_ERROR', `Exhaustion level must be between 1 and ${EXHAUSTION_MAX_LEVEL}.`, { remaining: `Enter a level from 1 to ${EXHAUSTION_MAX_LEVEL}.` })
  }
  return { duration: null, remaining: level }
}

export function assertExhaustionCreate(conn: Connection, combatantId: string, input: { name: string }) {
  if (!isExhaustion(input.name)) return
  const conditions = conn.query.encounterCondition.findMany({ where: eq(tables.encounterCondition.combatantId, combatantId) }).sync()
  if (conditions.some(c => isExhaustion(c.name))) throw apiError(409, 'EXHAUSTION_EXISTS', 'Edit the existing exhaustion level instead.')
}

// Levels can be corrected freely; only the name is fixed because remaining means a level, not rounds.
export function assertExhaustionRename(conn: Connection, condition: tables.EncounterCondition, name?: string) {
  if (name === undefined || isExhaustion(name) === isExhaustion(condition.name)) return
  if (isExhaustion(condition.name)) throw apiError(409, 'EXHAUSTION_RENAME', 'Remove exhaustion and add the other condition instead.')
  assertExhaustionCreate(conn, condition.combatantId, { name })
}

export function addDownedExhaustion(conn: Connection, participant: tables.EncounterCombatant, currentHp: number | null | undefined, userId: string) {
  if (!(participant.currentHp !== null && participant.currentHp > 0 && currentHp === 0)) return
  if (participant.sourceType !== 'PLAYER_CHARACTER' && participant.sourceType !== 'CAMPAIGN_CHARACTER') return
  const conditions = conn.query.encounterCondition.findMany({ where: eq(tables.encounterCondition.combatantId, participant.id) }).sync()
  const condition = conditions.find(c => isExhaustion(c.name))
  const current = condition ? condition.remaining ?? 1 : 0
  if (current >= EXHAUSTION_MAX_LEVEL) return
  const level = current + 1
  if (condition) conn.update(tables.encounterCondition).set({ remaining: level, duration: null }).where(eq(tables.encounterCondition.id, condition.id)).run()
  else conn.insert(tables.encounterCondition).values({ combatantId: participant.id, name: 'Exhaustion', remaining: level }).run()
  conn.insert(tables.encounterEvent).values({
    encounterId: participant.encounterId, createdByUserId: userId, eventType: 'CONDITION',
    summary: `${participant.name} downed — exhaustion level ${level}`,
    payload: { schemaVersion: 1, action: 'exhaustion.downed', combatantId: participant.id, level },
  }).run()
}
