import { lifecycleTargets, type EncounterLifecycleAction } from '#shared/utils/encounter-policy'
import { prisma } from '#server/db/prisma'
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
    await prisma.$transaction(async tx => {
      const encounter = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { combatants: { orderBy: { sortOrder: 'asc' } } } })
      assertEncounterAction(encounter, 'initiative')
      const existing = encounter.combatants
      if (orderedCombatantIds.length !== existing.length || new Set(orderedCombatantIds).size !== existing.length || orderedCombatantIds.some(id => !existing.some(p => p.id === id))) {
        throw apiError(409, 'PARTICIPANTS_CHANGED', 'The participant list changed. Refresh and retry the order.')
      }
      const activeId = existing[encounter.currentTurnIndex]?.id
      const tempStart = Math.max(...existing.map(p => p.sortOrder), 0) + existing.length + 1
      for (const [index, participant] of existing.entries()) await tx.encounterCombatant.update({ where: { id: participant.id }, data: { sortOrder: tempStart + index } })
      for (const [index, id] of orderedCombatantIds.entries()) await tx.encounterCombatant.update({ where: { id }, data: { sortOrder: index } })
      const currentTurnIndex = orderedCombatantIds.indexOf(activeId || '')
      if (currentTurnIndex >= 0) await tx.campaignEncounter.update({ where: { id: encounterId }, data: { currentTurnIndex } })
    })
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

    const updated = await prisma.$transaction(async tx => {
      const current = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { combatants: true } })
      assertEncounterAction(current, action)
      const row = await tx.campaignEncounter.update({ where: { id: encounterId }, data: {
        status: nextStatus,
        ...(action === 'start' || action === 'reset' ? { currentRound: 1, currentTurnIndex: 0 } : {}),
      } })
      await tx.encounterEvent.create({ data: { encounterId, eventType: 'ENCOUNTER', summary: `${action.charAt(0).toUpperCase()}${action.slice(1)} encounter`, payload: { schemaVersion: 1, action: `encounter.${action}` }, createdByUserId: userId } })
      return row
    })

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

    const combatants = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

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
      await prisma.$transaction(
        targets.map((combatant) =>
          prisma.encounterCombatant.update({
            where: { id: combatant.id },
            data: {
              initiative: rollInitiative(),
            },
          })
        )
      )
    }

    const refreshed = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ initiative: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    await this.applySortOrder(
      encounterId,
      refreshed.map((combatant) => combatant.id),
    )

    const finalOrder = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

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
    await prisma.$transaction(async tx => {
      const current = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { combatants: true } })
      assertEncounterAction(current, 'initiative')
      if (combatantId && !current.combatants.some(participant => participant.id === combatantId)) {
        throw apiError(404, 'NOT_FOUND', 'Participant not found in this encounter.')
      }
      await tx.encounterCombatant.updateMany({ where: { encounterId, ...(combatantId ? { id: combatantId } : {}) }, data: { initiative: null } })
      await tx.encounterEvent.create({ data: { encounterId, createdByUserId: userId, eventType: 'TURN',
        summary: combatantId ? `Cleared initiative for ${current.combatants.find(p => p.id === combatantId)!.name}` : 'Cleared all initiative',
        payload: { schemaVersion: 1, action: 'initiative.clear', ...(combatantId ? { combatantId } : {}) },
      } })
    })
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

    const combatants = await prisma.encounterCombatant.findMany({ where: { encounterId } })
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

    const ordered = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

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
    return prisma.$transaction(async tx => {
      const encounter = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId }, include: { combatants: { orderBy: { sortOrder: 'asc' } } } })
      assertEncounterAction(encounter, 'turn')
      const ordered = encounter.combatants
      let currentTurnIndex = encounter.currentTurnIndex
      let currentRound = encounter.currentRound
      if (direction === 'rewind' && currentRound === 1 && currentTurnIndex === 0) throw apiError(409, 'FIRST_TURN', 'Already at the first turn.')
      const tick = async (timing: 'TURN_START' | 'TURN_END' | 'ROUND_END', participantId?: string) => {
        await tx.encounterCondition.updateMany({ where: {
          combatantId: participantId || { in: ordered.map(p => p.id) }, tickTiming: timing, remaining: { gt: 0 },
        }, data: { remaining: { decrement: 1 } } })
      }
      if (direction === 'advance') {
        await tick('TURN_END', ordered[currentTurnIndex]!.id)
        currentTurnIndex += 1
        if (currentTurnIndex >= ordered.length) { currentTurnIndex = 0; currentRound += 1; await tick('ROUND_END') }
        await tick('TURN_START', ordered[currentTurnIndex]!.id)
      } else {
        currentTurnIndex -= 1
        if (currentTurnIndex < 0) { currentTurnIndex = ordered.length - 1; currentRound -= 1 }
      }
      const row = await tx.campaignEncounter.update({ where: { id: encounterId }, data: { currentTurnIndex, currentRound } })
      await tx.encounterEvent.create({ data: { encounterId, eventType: 'TURN', createdByUserId: userId,
        summary: direction === 'advance' ? 'Advanced turn' : 'Rewound turn pointer (effects unchanged)',
        payload: { schemaVersion: 1, action: `turn.${direction}`, currentTurnIndex, currentRound },
      } })
      return toEncounterSummaryDto(row)
    })
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

    const updated = await prisma.campaignEncounter.update({
      where: { id: encounterId },
      data: { currentTurnIndex: index },
    })

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
    return prisma.$transaction(async tx => {
      const current = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId } })
      assertEncounterAction(current, input.action === 'damage' || input.action === 'heal' ? 'effects' : 'conditions')
      const ids = 'participantIds' in input ? input.participantIds : [input.participantId]
      const participants = await tx.encounterCombatant.findMany({ where: { encounterId, id: { in: ids } } })
      if (participants.length !== ids.length) throw apiError(404, 'NOT_FOUND', 'Every target must belong to this encounter; no changes were applied.')
      for (const participant of participants) {
        if (input.action === 'damage' || input.action === 'heal') {
          if (participant.currentHp === null) throw apiError(409, 'HP_REQUIRED', `Set current HP for ${participant.name} before applying ${input.action}.`)
          const absorbed = input.action === 'damage' ? Math.min(participant.tempHp, input.amount) : 0
          const currentHp = input.action === 'damage' ? Math.max(0, participant.currentHp - input.amount + absorbed)
            : Math.min(participant.maxHp ?? Number.MAX_SAFE_INTEGER, participant.currentHp + input.amount)
          await tx.encounterCombatant.update({ where: { id: participant.id }, data: { currentHp, tempHp: participant.tempHp - absorbed, isDefeated: currentHp === 0 } })
        } else if (input.action === 'condition-add') {
          await tx.encounterCondition.create({ data: { ...input.condition, combatantId: participant.id, remaining: input.condition.remaining ?? input.condition.duration } })
        } else {
          const condition = await tx.encounterCondition.findFirst({ where: { id: input.conditionId, combatantId: participant.id } })
          if (!condition) throw apiError(404, 'NOT_FOUND', 'Condition not found for this participant.')
          if (input.action === 'condition-remove') await tx.encounterCondition.delete({ where: { id: condition.id } })
          else await tx.encounterCondition.update({ where: { id: condition.id }, data: input.changes })
        }
        const hp = input.action === 'damage' || input.action === 'heal'
        await tx.encounterEvent.create({ data: {
          encounterId, createdByUserId: userId, eventType: hp ? 'HP' : 'CONDITION',
          summary: `${input.action} ${hp ? input.amount : ''} — ${participant.name}`,
          payload: { schemaVersion: 1, action: hp ? `hp.${input.action}` : input.action, combatantId: participant.id,
            ...(hp ? { amount: input.amount, ...(input.note ? { note: input.note } : {}) } : {}) },
        } })
      }
    })
  }

  async applyDamage(encounterId: string, combatantId: string, userId: string, input: EncounterDamageInput): Promise<EncounterCombatant> {
    await this.applyEffect(encounterId, userId, { action: 'damage', participantIds: [combatantId], ...input })
    return toEncounterCombatantDto(await prisma.encounterCombatant.findUniqueOrThrow({ where: { id: combatantId } }))
  }

  async applyHeal(encounterId: string, combatantId: string, userId: string, input: EncounterHealInput): Promise<EncounterCombatant> {
    await this.applyEffect(encounterId, userId, { action: 'heal', participantIds: [combatantId], ...input })
    return toEncounterCombatantDto(await prisma.encounterCombatant.findUniqueOrThrow({ where: { id: combatantId } }))
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

    const combatant = await prisma.encounterCombatant.findFirst({ where: { id: combatantId, encounterId } })
    if (!combatant) {
      throw apiError(404, 'NOT_FOUND', 'Combatant not found.')
    }

    const created = await prisma.encounterCondition.create({
      data: {
        combatantId,
        name: input.name,
        duration: input.duration,
        remaining: input.remaining ?? input.duration,
        tickTiming: input.tickTiming,
        source: input.source,
        notes: input.notes,
      },
    })

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

    const condition = await prisma.encounterCondition.findFirst({
      where: { id: conditionId, combatantId },
      include: { combatant: true },
    })

    if (!condition || condition.combatant.encounterId !== encounterId) {
      throw apiError(404, 'NOT_FOUND', 'Condition not found.')
    }

    const updated = await prisma.encounterCondition.update({
      where: { id: conditionId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'duration') ? { duration: input.duration ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'remaining') ? { remaining: input.remaining ?? null } : {}),
        ...(input.tickTiming ? { tickTiming: input.tickTiming } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'source') ? { source: input.source ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      },
    })

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

    const condition = await prisma.encounterCondition.findFirst({
      where: { id: conditionId, combatantId },
      include: { combatant: true },
    })
    if (!condition || condition.combatant.encounterId !== encounterId) {
      throw apiError(404, 'NOT_FOUND', 'Condition not found.')
    }

    await prisma.encounterCondition.delete({ where: { id: conditionId } })

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
