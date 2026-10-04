import { lifecycleTargets, type EncounterLifecycleAction } from '#shared/utils/encounter-policy'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, inArray, gt, asc, desc, sql } from 'drizzle-orm'
import type {
  EncounterCombatant,
  EncounterCondition,
  EncounterSummary,
} from '#shared/types/encounter'
import type {
  EncounterEffectInput,
  EncounterConditionCreateInput,
  EncounterConditionUpdateInput,
  EncounterDamageInput,
  EncounterHealInput,
  EncounterInitiativeRollInput,
  EncounterInitiativeReorderInput,
  EncounterSetActiveTurnInput,
} from '#shared/schemas/encounter'
import {
  assertEncounterAction,
  appendEncounterEvent,
  getEncounterWithAccess,
  logEncounterActivity,
  toEncounterCombatantDto,
  toEncounterConditionDto,
  toEncounterSummaryDto,
} from '#server/services/encounter/encounter-shared'
import { apiError } from '#server/utils/http'

const rollInitiative = () => Math.floor(Math.random() * 20) + 1

export class EncounterRuntimeService {
  private async applySortOrder(encounterId: string, orderedCombatantIds: string[]) {
    db.transaction( tx => {
      const encounter = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId)), with: {combatants: {orderBy: [asc(tables.encounterCombatant.sortOrder)]}}}).sync()!
      assertEncounterAction(encounter, 'initiative')
      const existing = encounter.combatants
      if (orderedCombatantIds.length !== existing.length || new Set(orderedCombatantIds).size !== existing.length || orderedCombatantIds.some(id => !existing.some(p => p.id === id))) {
        throw apiError(409, 'PARTICIPANTS_CHANGED', 'The participant list changed. Refresh and retry the order.')
      }
      const activeId = existing[encounter.currentTurnIndex]?.id
      const tempStart = Math.max(...existing.map(p => p.sortOrder), 0) + existing.length + 1
      for (const [index, participant] of existing.entries()) tx.update(tables.encounterCombatant).set({ sortOrder: tempStart + index }).where(and(eq(tables.encounterCombatant.id, participant.id))).returning().get()!
      for (const [index, id] of orderedCombatantIds.entries()) tx.update(tables.encounterCombatant).set({ sortOrder: index }).where(and(eq(tables.encounterCombatant.id, id))).returning().get()!
      const currentTurnIndex = orderedCombatantIds.indexOf(activeId || '')
      if (currentTurnIndex >= 0) tx.update(tables.campaignEncounter).set({ currentTurnIndex }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!
    }, { behavior: 'immediate' })
  }

  async transitionStatus(
    encounterId: string,
    userId: string,
    action: EncounterLifecycleAction,
  ): Promise<EncounterSummary> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    assertEncounterAction(encounter, action)
    const nextStatus = lifecycleTargets[action]

    const updated = db.transaction( tx => {
      const current = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId)), with: {combatants: true}}).sync()!
      assertEncounterAction(current, action)
      const row = tx.update(tables.campaignEncounter).set({
        status: nextStatus,
        ...(action === 'start' || action === 'reset' ? { currentRound: 1, currentTurnIndex: 0 } : {}),
      }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!
      tx.insert(tables.encounterEvent).values({ encounterId, eventType: 'ENCOUNTER', summary: `${action.charAt(0).toUpperCase()}${action.slice(1)} encounter`, payload: { schemaVersion: 1, action: `encounter.${action}` }, createdByUserId: userId }).returning().get()!
      return row
    }, { behavior: 'immediate' })

    await logEncounterActivity({
      actorUserId: userId,
      campaignId: encounter.campaignId,
      action: `ENCOUNTER_${action.toUpperCase()}`,
      targetType: 'ENCOUNTER',
      targetId: encounterId,
      summary: `${action.charAt(0).toUpperCase()}${action.slice(1)} encounter "${encounter.name}".`,
      metadata: {
        previousStatus: encounter.status,
        nextStatus,
      },
    })

    return toEncounterSummaryDto(updated)
  }

  async rollInitiative(
    encounterId: string,
    userId: string,
    input: EncounterInitiativeRollInput = { mode: 'ALL' },
  ): Promise<EncounterCombatant[]> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'initiative')

    const combatants = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId)), orderBy: [asc(tables.encounterCombatant.sortOrder), asc(tables.encounterCombatant.createdAt)]}).sync()

    if (input.combatantId && !combatants.some(combatant => combatant.id === input.combatantId)) {
      throw apiError(404, 'NOT_FOUND', 'Participant not found in this encounter.')
    }
    const shouldRollCombatant = (combatant: typeof combatants[number]) => {
      if (input.combatantId && combatant.id !== input.combatantId) return false
      if (input.mode === 'ALL') return true
      if (input.mode === 'UNSET') return combatant.initiative === null
      const isPc =
        combatant.sourceType === 'CAMPAIGN_CHARACTER'
        || combatant.sourceType === 'PLAYER_CHARACTER'
      return !isPc
    }

    const targets = combatants.filter(shouldRollCombatant)

    if (targets.length) {
      db.transaction(tx => {
        for (const combatant of targets) tx.update(tables.encounterCombatant).set({ initiative: rollInitiative() }).where(eq(tables.encounterCombatant.id, combatant.id)).run()
      }, { behavior: 'immediate' })
    }

    const refreshed = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId)), orderBy: [desc(tables.encounterCombatant.initiative), asc(tables.encounterCombatant.sortOrder), asc(tables.encounterCombatant.createdAt)]}).sync()

    await this.applySortOrder(
      encounterId,
      refreshed.map((combatant) => combatant.id),
    )

    const finalOrder = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId)), orderBy: [asc(tables.encounterCombatant.sortOrder), asc(tables.encounterCombatant.createdAt)]}).sync()

    await appendEncounterEvent(
      encounterId,
      'TURN',
      'Rolled initiative for encounter',
      { schemaVersion: 1, action: 'initiative.roll', mode: input.mode, ...(input.combatantId ? { combatantId: input.combatantId } : {}), affected: targets.length },
      userId,
    )

    return finalOrder.map(toEncounterCombatantDto)
  }

  async clearInitiative(encounterId: string, userId: string, combatantId?: string) {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    db.transaction( tx => {
      const current = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId)), with: {combatants: true}}).sync()!
      assertEncounterAction(current, 'initiative')
      if (combatantId && !current.combatants.some(participant => participant.id === combatantId)) {
        throw apiError(404, 'NOT_FOUND', 'Participant not found in this encounter.')
      }
      tx.update(tables.encounterCombatant).set({ initiative: null }).where(and(eq(tables.encounterCombatant.encounterId, encounterId), combatantId ? and(eq(tables.encounterCombatant.id, combatantId)) : undefined)).run()
      tx.insert(tables.encounterEvent).values({ encounterId, createdByUserId: userId, eventType: 'TURN',
        summary: combatantId ? `Cleared initiative for ${current.combatants.find(p => p.id === combatantId)!.name}` : 'Cleared all initiative',
        payload: { schemaVersion: 1, action: 'initiative.clear', ...(combatantId ? { combatantId } : {}) },
      }).returning().get()!
    }, { behavior: 'immediate' })
  }

  async reorderInitiative(
    encounterId: string,
    userId: string,
    input: EncounterInitiativeReorderInput,
  ): Promise<EncounterCombatant[]> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'initiative')

    const combatants = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId))}).sync()
    const combatantSet = new Set(combatants.map((combatant) => combatant.id))
    if (
      new Set(input.combatantOrder).size !== combatants.length
      || input.combatantOrder.length !== combatants.length
      || input.combatantOrder.some((id) => !combatantSet.has(id))
    ) {
      throw apiError(400, 'VALIDATION_ERROR', 'Combatant order must include all encounter combatants exactly once.')
    }

    await this.applySortOrder(encounterId, input.combatantOrder)

    await appendEncounterEvent(
      encounterId,
      'TURN',
      'Reordered initiative manually',
      { schemaVersion: 1, action: 'initiative.reorder' },
      userId,
    )

    const ordered = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId)), orderBy: [asc(tables.encounterCombatant.sortOrder), asc(tables.encounterCombatant.createdAt)]}).sync()

    return ordered.map(toEncounterCombatantDto)
  }

  async advanceTurn(encounterId: string, userId: string): Promise<EncounterSummary> {
    return this.moveTurn(encounterId, userId, 'advance')
  }

  async rewindTurn(encounterId: string, userId: string): Promise<EncounterSummary> {
    return this.moveTurn(encounterId, userId, 'rewind')
  }

  private async moveTurn(encounterId: string, userId: string, direction: 'advance' | 'rewind'): Promise<EncounterSummary> {
    const accessible = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!accessible) throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    return db.transaction( tx => {
      const encounter = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId)), with: {combatants: {orderBy: [asc(tables.encounterCombatant.sortOrder)]}}}).sync()!
      assertEncounterAction(encounter, 'turn')
      const ordered = encounter.combatants
      let currentTurnIndex = encounter.currentTurnIndex
      let currentRound = encounter.currentRound
      if (direction === 'rewind' && currentRound === 1 && currentTurnIndex === 0) throw apiError(409, 'FIRST_TURN', 'Already at the first turn.')
      const tick = (timing: 'TURN_START' | 'TURN_END' | 'ROUND_END', participantId?: string) => {
        tx.update(tables.encounterCondition).set({ remaining: sql`${tables.encounterCondition.remaining} - 1` }).where(and(participantId ? eq(tables.encounterCondition.combatantId, participantId) : inArray(tables.encounterCondition.combatantId, ordered.map(p => p.id)), eq(tables.encounterCondition.tickTiming, timing), and(gt(tables.encounterCondition.remaining, 0)))).run()
      }
      if (direction === 'advance') {
        tick('TURN_END', ordered[currentTurnIndex]!.id)
        currentTurnIndex += 1
        if (currentTurnIndex >= ordered.length) { currentTurnIndex = 0; currentRound += 1; tick('ROUND_END') }
        tick('TURN_START', ordered[currentTurnIndex]!.id)
      } else {
        currentTurnIndex -= 1
        if (currentTurnIndex < 0) { currentTurnIndex = ordered.length - 1; currentRound -= 1 }
      }
      const row = tx.update(tables.campaignEncounter).set({ currentTurnIndex, currentRound }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!
      tx.insert(tables.encounterEvent).values({ encounterId, eventType: 'TURN', createdByUserId: userId,
        summary: direction === 'advance' ? 'Advanced turn' : 'Rewound turn pointer (effects unchanged)',
        payload: { schemaVersion: 1, action: `turn.${direction}`, currentTurnIndex, currentRound },
      }).returning().get()!
      return toEncounterSummaryDto(row)
    }, { behavior: 'immediate' })
  }

  async setActiveTurn(
    encounterId: string,
    userId: string,
    input: EncounterSetActiveTurnInput,
  ): Promise<EncounterSummary> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'turn')

    const ordered = [...encounter.combatants].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((combatant) => combatant.id === input.combatantId)

    if (index < 0) {
      throw apiError(404, 'NOT_FOUND', 'Combatant not found.')
    }

    const updated = db.update(tables.campaignEncounter).set({ currentTurnIndex: index }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!

    await appendEncounterEvent(
      encounterId,
      'TURN',
      'Set active turn combatant',
      { schemaVersion: 1, action: 'turn.set-active', combatantId: input.combatantId, currentTurnIndex: index },
      userId,
    )

    return toEncounterSummaryDto(updated)
  }

  async applyEffect(encounterId: string, userId: string, input: EncounterEffectInput) {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    assertEncounterAction(encounter, input.action === 'damage' || input.action === 'heal' ? 'effects' : 'conditions')
    return db.transaction( tx => {
      const current = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId))}).sync()!
      assertEncounterAction(current, input.action === 'damage' || input.action === 'heal' ? 'effects' : 'conditions')
      const ids = 'participantIds' in input ? input.participantIds : [input.participantId]
      const participants = tx.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId), and(inArray(tables.encounterCombatant.id, ids)))}).sync()
      if (participants.length !== ids.length) throw apiError(404, 'NOT_FOUND', 'Every target must belong to this encounter; no changes were applied.')
      for (const participant of participants) {
        if (input.action === 'damage' || input.action === 'heal') {
          if (participant.currentHp === null) throw apiError(409, 'HP_REQUIRED', `Set current HP for ${participant.name} before applying ${input.action}.`)
          const absorbed = input.action === 'damage' ? Math.min(participant.tempHp, input.amount) : 0
          const currentHp = input.action === 'damage' ? Math.max(0, participant.currentHp - input.amount + absorbed)
            : Math.min(participant.maxHp ?? Number.MAX_SAFE_INTEGER, participant.currentHp + input.amount)
          tx.update(tables.encounterCombatant).set({ currentHp, tempHp: participant.tempHp - absorbed, isDefeated: currentHp === 0 }).where(and(eq(tables.encounterCombatant.id, participant.id))).returning().get()!
        } else if (input.action === 'condition-add') {
          tx.insert(tables.encounterCondition).values({ ...input.condition, combatantId: participant.id, remaining: input.condition.remaining ?? input.condition.duration }).returning().get()!
        } else {
          const condition = tx.query.encounterCondition.findFirst({where: and(eq(tables.encounterCondition.id, input.conditionId), eq(tables.encounterCondition.combatantId, participant.id))}).sync()
          if (!condition) throw apiError(404, 'NOT_FOUND', 'Condition not found for this participant.')
          if (input.action === 'condition-remove') tx.delete(tables.encounterCondition).where(and(eq(tables.encounterCondition.id, condition.id))).returning().get()!
          else tx.update(tables.encounterCondition).set(input.changes).where(and(eq(tables.encounterCondition.id, condition.id))).returning().get()!
        }
        const hp = input.action === 'damage' || input.action === 'heal'
        tx.insert(tables.encounterEvent).values({
          encounterId, createdByUserId: userId, eventType: hp ? 'HP' : 'CONDITION',
          summary: `${input.action} ${hp ? input.amount : ''} — ${participant.name}`,
          payload: { schemaVersion: 1, action: hp ? `hp.${input.action}` : input.action, combatantId: participant.id,
            ...(hp ? { amount: input.amount, ...(input.note ? { note: input.note } : {}) } : {}) },
        }).returning().get()!
      }
    }, { behavior: 'immediate' })
  }

  async applyDamage(encounterId: string, combatantId: string, userId: string, input: EncounterDamageInput): Promise<EncounterCombatant> {
    await this.applyEffect(encounterId, userId, { action: 'damage', participantIds: [combatantId], ...input })
    return toEncounterCombatantDto(db.query.encounterCombatant.findFirst({where: and(eq(tables.encounterCombatant.id, combatantId))}).sync()!)
  }

  async applyHeal(encounterId: string, combatantId: string, userId: string, input: EncounterHealInput): Promise<EncounterCombatant> {
    await this.applyEffect(encounterId, userId, { action: 'heal', participantIds: [combatantId], ...input })
    return toEncounterCombatantDto(db.query.encounterCombatant.findFirst({where: and(eq(tables.encounterCombatant.id, combatantId))}).sync()!)
  }

  async createCondition(
    encounterId: string,
    combatantId: string,
    userId: string,
    input: EncounterConditionCreateInput,
  ): Promise<EncounterCondition> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'conditions')

    const combatant = db.query.encounterCombatant.findFirst({where: and(eq(tables.encounterCombatant.id, combatantId), eq(tables.encounterCombatant.encounterId, encounterId))}).sync()
    if (!combatant) {
      throw apiError(404, 'NOT_FOUND', 'Combatant not found.')
    }

    const created = db.insert(tables.encounterCondition).values({
        combatantId,
        name: input.name,
        duration: input.duration,
        remaining: input.remaining ?? input.duration,
        tickTiming: input.tickTiming,
        source: input.source,
        notes: input.notes,
      }).returning().get()!

    await appendEncounterEvent(
      encounterId,
      'CONDITION',
      `Added condition ${created.name} to ${combatant.name}`,
      { schemaVersion: 1, action: 'condition.create', combatantId, conditionId: created.id },
      userId,
    )

    return toEncounterConditionDto(created)
  }

  async updateCondition(
    encounterId: string,
    combatantId: string,
    conditionId: string,
    userId: string,
    input: EncounterConditionUpdateInput,
  ): Promise<EncounterCondition> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'conditions')

    const condition = db.query.encounterCondition.findFirst({where: and(eq(tables.encounterCondition.id, conditionId), eq(tables.encounterCondition.combatantId, combatantId)), with: {combatant: true}}).sync()

    if (!condition || condition.combatant.encounterId !== encounterId) {
      throw apiError(404, 'NOT_FOUND', 'Condition not found.')
    }

    const updated = db.update(tables.encounterCondition).set({
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'duration') ? { duration: input.duration ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'remaining') ? { remaining: input.remaining ?? null } : {}),
        ...(input.tickTiming ? { tickTiming: input.tickTiming } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'source') ? { source: input.source ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      }).where(and(eq(tables.encounterCondition.id, conditionId))).returning().get()!

    await appendEncounterEvent(
      encounterId,
      'CONDITION',
      `Updated condition ${updated.name}`,
      { schemaVersion: 1, action: 'condition.update', conditionId },
      userId,
    )

    return toEncounterConditionDto(updated)
  }

  async deleteCondition(
    encounterId: string,
    combatantId: string,
    conditionId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }
    assertEncounterAction(encounter, 'conditions')

    const condition = db.query.encounterCondition.findFirst({where: and(eq(tables.encounterCondition.id, conditionId), eq(tables.encounterCondition.combatantId, combatantId)), with: {combatant: true}}).sync()
    if (!condition || condition.combatant.encounterId !== encounterId) {
      throw apiError(404, 'NOT_FOUND', 'Condition not found.')
    }

    db.delete(tables.encounterCondition).where(and(eq(tables.encounterCondition.id, conditionId))).returning().get()!

    await appendEncounterEvent(
      encounterId,
      'CONDITION',
      `Removed condition ${condition.name}`,
      { schemaVersion: 1, action: 'condition.delete', conditionId },
      userId,
    )

    return { deleted: true }
  }

}
