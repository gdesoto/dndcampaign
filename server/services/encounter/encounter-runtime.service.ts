import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
import type {
  EncounterCombatant,
  EncounterCondition,
  EncounterRuntimeBoard,
  EncounterSummary,
} from '#shared/types/encounter'
import type {
  EncounterConditionCreateInput,
  EncounterConditionUpdateInput,
  EncounterDamageInput,
  EncounterHealInput,
  EncounterInitiativeRollInput,
  EncounterInitiativeReorderInput,
  EncounterSetActiveTurnInput,
} from '#shared/schemas/encounter'
import {
  appendEncounterEvent,
  getEncounterWithAccess,
  logEncounterActivity,
  toEncounterCombatantDto,
  toEncounterConditionDto,
  toEncounterSummaryDto,
} from '#server/services/encounter/encounter-shared'

type EncounterLifecycleAction = 'start' | 'pause' | 'resume' | 'complete' | 'abandon' | 'reset'

const lifecycleTarget: Record<EncounterLifecycleAction, EncounterSummary['status']> = {
  start: 'ACTIVE',
  pause: 'PAUSED',
  resume: 'ACTIVE',
  complete: 'COMPLETED',
  abandon: 'ABANDONED',
  reset: 'PLANNED',
}

const transitionAllowed = (from: EncounterSummary['status'], to: EncounterSummary['status']) => {
  if (from === to) return true
  if (from === 'PLANNED' && to === 'ACTIVE') return true
  if (from === 'ACTIVE' && (to === 'PAUSED' || to === 'COMPLETED' || to === 'ABANDONED')) return true
  if (from === 'PAUSED' && (to === 'ACTIVE' || to === 'COMPLETED' || to === 'ABANDONED')) return true
  if (from === 'COMPLETED' && to === 'ACTIVE') return true
  if (from === 'ABANDONED' && to === 'ACTIVE') return true
  return false
}

const rollInitiative = () => Math.floor(Math.random() * 20) + 1

export class EncounterRuntimeService {
  private async applySortOrder(encounterId: string, orderedCombatantIds: string[]) {
    const existing = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      select: { id: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    })
    if (!existing.length) return

    const maxSortOrder = existing.reduce((max, entry) => Math.max(max, entry.sortOrder), -1)
    const tempStart = maxSortOrder + existing.length + 1000

    await prisma.$transaction(
      existing.map((combatant, index) =>
        prisma.encounterCombatant.update({
          where: { id: combatant.id },
          data: { sortOrder: tempStart + index },
        })
      )
    )

    await prisma.$transaction(
      orderedCombatantIds.map((combatantId, index) =>
        prisma.encounterCombatant.update({
          where: { id: combatantId },
          data: { sortOrder: index },
        })
      )
    )
  }

  async transitionStatus(
    encounterId: string,
    userId: string,
    action: EncounterLifecycleAction,
  ): Promise<ServiceResult<EncounterSummary>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const nextStatus = lifecycleTarget[action]
    if (action !== 'reset' && !transitionAllowed(encounter.status, nextStatus)) {
      return {
        ok: false,
        statusCode: 409,
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition encounter from ${encounter.status} to ${nextStatus}.`,
      }
    }

    const updated = await prisma.campaignEncounter.update({
      where: { id: encounterId },
      data: {
        status: nextStatus,
        ...(action === 'start' || action === 'reset' ? { currentRound: 1, currentTurnIndex: 0 } : {}),
      },
    })

    await appendEncounterEvent(
      encounterId,
      'ENCOUNTER',
      `${action.charAt(0).toUpperCase()}${action.slice(1)} encounter`,
      { schemaVersion: 1, action: `encounter.${action}` },
      userId,
    )
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

    return { ok: true, data: toEncounterSummaryDto(updated) }
  }

  async rollInitiative(
    encounterId: string,
    userId: string,
    input: EncounterInitiativeRollInput = { mode: 'ALL' },
  ): Promise<ServiceResult<EncounterCombatant[]>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatants = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const shouldRollCombatant = (combatant: typeof combatants[number]) => {
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
      { schemaVersion: 1, action: 'initiative.roll', mode: input.mode, affected: targets.length },
      userId,
    )

    return { ok: true, data: finalOrder.map(toEncounterCombatantDto) }
  }

  async reorderInitiative(
    encounterId: string,
    userId: string,
    input: EncounterInitiativeReorderInput,
  ): Promise<ServiceResult<EncounterCombatant[]>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatants = await prisma.encounterCombatant.findMany({ where: { encounterId } })
    const combatantSet = new Set(combatants.map((combatant) => combatant.id))
    if (
      input.combatantOrder.length !== combatants.length
      || input.combatantOrder.some((id) => !combatantSet.has(id))
    ) {
      return {
        ok: false,
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Combatant order must include all encounter combatants exactly once.',
      }
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

    return { ok: true, data: ordered.map(toEncounterCombatantDto) }
  }

  async advanceTurn(encounterId: string, userId: string): Promise<ServiceResult<EncounterSummary>> {
    return this.moveTurn(encounterId, userId, 'advance')
  }

  async rewindTurn(encounterId: string, userId: string): Promise<ServiceResult<EncounterSummary>> {
    return this.moveTurn(encounterId, userId, 'rewind')
  }

  private async moveTurn(
    encounterId: string,
    userId: string,
    direction: 'advance' | 'rewind',
  ): Promise<ServiceResult<EncounterSummary>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatantCount = encounter.combatants.length
    if (!combatantCount) {
      return {
        ok: false,
        statusCode: 409,
        code: 'NO_COMBATANTS',
        message: 'Cannot move turn without combatants.',
      }
    }

    let nextTurnIndex = encounter.currentTurnIndex
    let nextRound = encounter.currentRound

    if (direction === 'advance') {
      nextTurnIndex += 1
      if (nextTurnIndex >= combatantCount) {
        nextTurnIndex = 0
        nextRound += 1
        await this.tickRoundEndConditions(encounterId)
      }
    } else {
      nextTurnIndex -= 1
      if (nextTurnIndex < 0) {
        nextTurnIndex = combatantCount - 1
        nextRound = Math.max(1, nextRound - 1)
      }
    }

    const updated = await prisma.campaignEncounter.update({
      where: { id: encounterId },
      data: {
        currentTurnIndex: nextTurnIndex,
        currentRound: nextRound,
      },
    })

    await appendEncounterEvent(
      encounterId,
      'TURN',
      `${direction === 'advance' ? 'Advanced' : 'Rewound'} turn`,
      {
        schemaVersion: 1,
        action: `turn.${direction}`,
        currentTurnIndex: nextTurnIndex,
        currentRound: nextRound,
      },
      userId,
    )

    return { ok: true, data: toEncounterSummaryDto(updated) }
  }

  async setActiveTurn(
    encounterId: string,
    userId: string,
    input: EncounterSetActiveTurnInput,
  ): Promise<ServiceResult<EncounterSummary>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const ordered = [...encounter.combatants].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((combatant) => combatant.id === input.combatantId)

    if (index < 0) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Combatant not found.',
      }
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

    return { ok: true, data: toEncounterSummaryDto(updated) }
  }

  async applyDamage(
    encounterId: string,
    combatantId: string,
    userId: string,
    input: EncounterDamageInput,
  ): Promise<ServiceResult<EncounterCombatant>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatant = await prisma.encounterCombatant.findFirst({ where: { id: combatantId, encounterId } })
    if (!combatant) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Combatant not found.',
      }
    }

    let remainingDamage = input.amount
    let tempHp = combatant.tempHp
    let currentHp = combatant.currentHp ?? 0

    if (tempHp > 0) {
      const absorbed = Math.min(tempHp, remainingDamage)
      tempHp -= absorbed
      remainingDamage -= absorbed
    }

    if (remainingDamage > 0) {
      currentHp = Math.max(0, currentHp - remainingDamage)
    }

    const updated = await prisma.encounterCombatant.update({
      where: { id: combatantId },
      data: {
        tempHp,
        currentHp,
        isDefeated: currentHp <= 0,
      },
    })

    await appendEncounterEvent(
      encounterId,
      'HP',
      `Applied ${input.amount} damage to ${combatant.name}`,
      {
        schemaVersion: 1,
        action: 'hp.damage',
        combatantId,
        amount: input.amount,
        note: input.note,
      },
      userId,
    )

    return { ok: true, data: toEncounterCombatantDto(updated) }
  }

  async applyHeal(
    encounterId: string,
    combatantId: string,
    userId: string,
    input: EncounterHealInput,
  ): Promise<ServiceResult<EncounterCombatant>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatant = await prisma.encounterCombatant.findFirst({ where: { id: combatantId, encounterId } })
    if (!combatant) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Combatant not found.',
      }
    }

    const baselineHp = combatant.currentHp ?? 0
    const maxHp = combatant.maxHp ?? Number.MAX_SAFE_INTEGER
    const currentHp = Math.min(maxHp, baselineHp + input.amount)

    const updated = await prisma.encounterCombatant.update({
      where: { id: combatantId },
      data: {
        currentHp,
        isDefeated: currentHp <= 0,
      },
    })

    await appendEncounterEvent(
      encounterId,
      'HP',
      `Applied ${input.amount} healing to ${combatant.name}`,
      {
        schemaVersion: 1,
        action: 'hp.heal',
        combatantId,
        amount: input.amount,
        note: input.note,
      },
      userId,
    )

    return { ok: true, data: toEncounterCombatantDto(updated) }
  }

  async createCondition(
    encounterId: string,
    combatantId: string,
    userId: string,
    input: EncounterConditionCreateInput,
  ): Promise<ServiceResult<EncounterCondition>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const combatant = await prisma.encounterCombatant.findFirst({ where: { id: combatantId, encounterId } })
    if (!combatant) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Combatant not found.',
      }
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

    return { ok: true, data: toEncounterConditionDto(created) }
  }

  async updateCondition(
    encounterId: string,
    combatantId: string,
    conditionId: string,
    userId: string,
    input: EncounterConditionUpdateInput,
  ): Promise<ServiceResult<EncounterCondition>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const condition = await prisma.encounterCondition.findFirst({
      where: { id: conditionId, combatantId },
      include: { combatant: true },
    })

    if (!condition || condition.combatant.encounterId !== encounterId) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Condition not found.',
      }
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

    return { ok: true, data: toEncounterConditionDto(updated) }
  }

  async deleteCondition(
    encounterId: string,
    combatantId: string,
    conditionId: string,
    userId: string,
  ): Promise<ServiceResult<{ deleted: true }>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const condition = await prisma.encounterCondition.findFirst({
      where: { id: conditionId, combatantId },
      include: { combatant: true },
    })
    if (!condition || condition.combatant.encounterId !== encounterId) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Condition not found.',
      }
    }

    await prisma.encounterCondition.delete({ where: { id: conditionId } })

    await appendEncounterEvent(
      encounterId,
      'CONDITION',
      `Removed condition ${condition.name}`,
      { schemaVersion: 1, action: 'condition.delete', conditionId },
      userId,
    )

    return { ok: true, data: { deleted: true } }
  }

  async getRuntimeBoard(encounterId: string, userId: string): Promise<ServiceResult<EncounterRuntimeBoard>> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')
    if (!encounter) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter not found or access denied.',
      }
    }

    const initiativeLane = [...encounter.combatants]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((combatant, index) => ({
        combatantId: combatant.id,
        name: combatant.name,
        side: combatant.side,
        initiative: combatant.initiative,
        sortOrder: combatant.sortOrder,
        isActive: index === encounter.currentTurnIndex,
        isDefeated: combatant.isDefeated,
      }))

    const warnings: string[] = []
    if (!initiativeLane.length) {
      warnings.push('No combatants added yet.')
    }
    if (encounter.status !== 'ACTIVE') {
      warnings.push('Encounter is not currently active.')
    }

    return {
      ok: true,
      data: {
        encounterId,
        round: encounter.currentRound,
        activeCombatantId: initiativeLane.find((item) => item.isActive)?.combatantId || null,
        initiativeLane,
        warnings,
      },
    }
  }

  private async tickRoundEndConditions(encounterId: string) {
    const combatants = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      select: { id: true },
    })

    const combatantIds = combatants.map((combatant) => combatant.id)
    if (!combatantIds.length) return

    const conditions = await prisma.encounterCondition.findMany({
      where: {
        combatantId: { in: combatantIds },
        tickTiming: 'ROUND_END',
        remaining: { not: null },
      },
    })

    await prisma.$transaction(
      conditions.map((condition) =>
        prisma.encounterCondition.update({
          where: { id: condition.id },
          data: { remaining: Math.max(0, (condition.remaining || 0) - 1) },
        })
      )
    )
  }
}
