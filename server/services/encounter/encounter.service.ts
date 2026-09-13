import { prisma } from '#server/db/prisma'
import type {
  EncounterCombatant,
  EncounterDetail,
  EncounterEvent,
  EncounterSummary,
} from '#shared/types/encounter'
import type {
  EncounterCombatantCreateInput,
  EncounterCombatantUpdateInput,
  EncounterCreateInput,
  EncounterEventNoteCreateInput,
  EncounterListQueryInput,
  EncounterUpdateInput,
} from '#shared/schemas/encounter'
import {
  appendEncounterEvent,
  getEncounterWithAccess,
  logEncounterActivity,
  toEncounterCombatantDto,
  toEncounterDetailDto,
  toEncounterEventDto,
  toEncounterSummaryDto,
  validateEncounterCombatantSourceReferences,
  validateEncounterCalendarLink,
  validateEncounterSessionLink,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

const transitionAllowed = (from: EncounterSummary['status'], to: EncounterSummary['status']) => {
  if (from === to) return true
  if (from === 'PLANNED' && to === 'ACTIVE') return true
  if (from === 'ACTIVE' && (to === 'PAUSED' || to === 'COMPLETED' || to === 'ABANDONED')) return true
  if (from === 'PAUSED' && (to === 'ACTIVE' || to === 'COMPLETED' || to === 'ABANDONED')) return true
  if (from === 'COMPLETED' && to === 'ACTIVE') return true
  if (from === 'ABANDONED' && to === 'ACTIVE') return true
  return false
}

export class EncounterService {
  async listEncounters(campaignId: string, query: EncounterListQueryInput): Promise<EncounterSummary[]> {
    const encounters = await prisma.campaignEncounter.findMany({
      where: {
        campaignId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return encounters.map(toEncounterSummaryDto)
  }

  async createEncounter(
    campaignId: string,
    userId: string,
    input: EncounterCreateInput,
  ): Promise<EncounterSummary> {
    await validateEncounterSessionLink(campaignId, input.sessionId)

    const dateLink = await validateEncounterCalendarLink(campaignId, {
      calendarYear: input.calendarYear,
      calendarMonth: input.calendarMonth,
      calendarDay: input.calendarDay,
    })

    const created = await prisma.campaignEncounter.create({
      data: {
        campaignId,
        sessionId: input.sessionId,
        name: input.name,
        type: input.type,
        visibility: input.visibility,
        notes: input.notes,
        calendarYear: dateLink.calendarYear,
        calendarMonth: dateLink.calendarMonth,
        calendarDay: dateLink.calendarDay,
        createdByUserId: userId,
      },
    })

    await appendEncounterEvent(
      created.id,
      'ENCOUNTER',
      `Created encounter ${created.name}`,
      { schemaVersion: 1, action: 'create' },
      userId,
    )
    await logEncounterActivity({
      actorUserId: userId,
      campaignId,
      action: 'ENCOUNTER_CREATED',
      targetType: 'ENCOUNTER',
      targetId: created.id,
      summary: `Created encounter "${created.name}".`,
      metadata: {
        status: created.status,
        type: created.type,
      },
    })

    return toEncounterSummaryDto(created)
  }

  async getEncounter(encounterId: string, userId: string): Promise<EncounterDetail> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')

    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const combatantIds = encounter.combatants.map((combatant) => combatant.id)
    const conditions = combatantIds.length
      ? await prisma.encounterCondition.findMany({
        where: { combatantId: { in: combatantIds } },
        orderBy: [{ createdAt: 'asc' }],
      })
      : []

    return toEncounterDetailDto(encounter, conditions)
  }

  async updateEncounter(
    encounterId: string,
    userId: string,
    input: EncounterUpdateInput,
  ): Promise<EncounterSummary> {
    const existing = await prisma.campaignEncounter.findFirst({
      where: {
        id: encounterId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: {
        id: true,
        campaignId: true,
        status: true,
        sessionId: true,
        calendarYear: true,
        calendarMonth: true,
        calendarDay: true,
      },
    })

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const nextSessionId = Object.prototype.hasOwnProperty.call(input, 'sessionId')
      ? input.sessionId || undefined
      : existing.sessionId || undefined
    await validateEncounterSessionLink(existing.campaignId, nextSessionId)

    const nextCalendar = {
      calendarYear: Object.prototype.hasOwnProperty.call(input, 'calendarYear')
        ? input.calendarYear
        : existing.calendarYear,
      calendarMonth: Object.prototype.hasOwnProperty.call(input, 'calendarMonth')
        ? input.calendarMonth
        : existing.calendarMonth,
      calendarDay: Object.prototype.hasOwnProperty.call(input, 'calendarDay')
        ? input.calendarDay
        : existing.calendarDay,
    }

    await validateEncounterCalendarLink(existing.campaignId, nextCalendar)

    if (input.status && !transitionAllowed(existing.status, input.status)) {
      throw apiError(409, 'INVALID_STATE_TRANSITION', `Cannot transition encounter from ${existing.status} to ${input.status}.`)
    }

    if (typeof input.currentTurnIndex === 'number') {
      const combatantCount = await prisma.encounterCombatant.count({
        where: { encounterId },
      })
      const maxAllowedTurnIndex = Math.max(0, combatantCount - 1)
      if (input.currentTurnIndex > maxAllowedTurnIndex) {
        throw apiError(400, 'VALIDATION_ERROR', 'Turn index is out of bounds for current combatants.', {
            currentTurnIndex: `Must be between 0 and ${maxAllowedTurnIndex}.`,
          })
      }
    }

    const updated = await prisma.campaignEncounter.update({
      where: { id: encounterId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'sessionId') ? { sessionId: input.sessionId ?? null } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarYear') ? { calendarYear: input.calendarYear ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarMonth') ? { calendarMonth: input.calendarMonth ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarDay') ? { calendarDay: input.calendarDay ?? null } : {}),
        ...(typeof input.currentRound === 'number' ? { currentRound: input.currentRound } : {}),
        ...(typeof input.currentTurnIndex === 'number' ? { currentTurnIndex: input.currentTurnIndex } : {}),
      },
    })

    await appendEncounterEvent(
      encounterId,
      'ENCOUNTER',
      `Updated encounter ${updated.name}`,
      { schemaVersion: 1, action: 'update' },
      userId,
    )
    await logEncounterActivity({
      actorUserId: userId,
      campaignId: existing.campaignId,
      action: 'ENCOUNTER_UPDATED',
      targetType: 'ENCOUNTER',
      targetId: encounterId,
      summary: `Updated encounter "${updated.name}".`,
      metadata: {
        status: updated.status,
        type: updated.type,
      },
    })

    return toEncounterSummaryDto(updated)
  }

  async deleteEncounter(encounterId: string, userId: string): Promise<{ deleted: true }> {
    const existing = await prisma.campaignEncounter.findFirst({
      where: {
        id: encounterId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const deleted = await prisma.campaignEncounter.delete({ where: { id: encounterId } })
    await logEncounterActivity({
      actorUserId: userId,
      campaignId: deleted.campaignId,
      action: 'ENCOUNTER_DELETED',
      targetType: 'ENCOUNTER',
      targetId: encounterId,
      summary: `Deleted encounter "${deleted.name}".`,
    })
    return { deleted: true }
  }

  async listCombatants(encounterId: string, userId: string): Promise<EncounterCombatant[]> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const combatants = await prisma.encounterCombatant.findMany({
      where: { encounterId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return combatants.map(toEncounterCombatantDto)
  }

  async createCombatant(
    encounterId: string,
    userId: string,
    input: EncounterCombatantCreateInput,
  ): Promise<EncounterCombatant> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const maxSortOrder = await prisma.encounterCombatant.aggregate({
      where: { encounterId },
      _max: { sortOrder: true },
    })

    await validateEncounterCombatantSourceReferences(encounter.campaignId, {
      sourceType: input.sourceType,
      sourceCampaignCharacterId: input.sourceCampaignCharacterId,
      sourcePlayerCharacterId: input.sourcePlayerCharacterId,
      sourceGlossaryEntryId: input.sourceGlossaryEntryId,
      sourceStatBlockId: input.sourceStatBlockId,
    })

    const created = await prisma.encounterCombatant.create({
      data: {
        encounterId,
        name: input.name,
        side: input.side,
        sourceType: input.sourceType,
        sourceCampaignCharacterId: input.sourceCampaignCharacterId,
        sourcePlayerCharacterId: input.sourcePlayerCharacterId,
        sourceGlossaryEntryId: input.sourceGlossaryEntryId,
        sourceStatBlockId: input.sourceStatBlockId,
        initiative: input.initiative,
        sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
        maxHp: input.maxHp,
        currentHp: input.currentHp ?? input.maxHp,
        tempHp: input.tempHp,
        armorClass: input.armorClass,
        speed: input.speed,
        isHidden: input.isHidden,
        notes: input.notes,
      },
    })

    await appendEncounterEvent(
      encounterId,
      'ENCOUNTER',
      `Added combatant ${created.name}`,
      { schemaVersion: 1, action: 'combatant.create', combatantId: created.id },
      userId,
    )

    return toEncounterCombatantDto(created)
  }

  async updateCombatant(
    encounterId: string,
    combatantId: string,
    userId: string,
    input: EncounterCombatantUpdateInput,
  ): Promise<EncounterCombatant> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const existing = await prisma.encounterCombatant.findFirst({
      where: { id: combatantId, encounterId },
    })
    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Combatant not found.')
    }

    const nextSourceType = input.sourceType || existing.sourceType
    const nextSourceCampaignCharacterId = existing.sourceCampaignCharacterId
    const nextSourcePlayerCharacterId = existing.sourcePlayerCharacterId
    const nextSourceGlossaryEntryId = existing.sourceGlossaryEntryId
    const nextSourceStatBlockId = Object.prototype.hasOwnProperty.call(input, 'sourceStatBlockId')
      ? input.sourceStatBlockId ?? null
      : existing.sourceStatBlockId

    await validateEncounterCombatantSourceReferences(encounter.campaignId, {
      sourceType: nextSourceType,
      sourceCampaignCharacterId: nextSourceCampaignCharacterId,
      sourcePlayerCharacterId: nextSourcePlayerCharacterId,
      sourceGlossaryEntryId: nextSourceGlossaryEntryId,
      sourceStatBlockId: nextSourceStatBlockId,
    })

    const updated = await prisma.encounterCombatant.update({
      where: { id: combatantId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.side ? { side: input.side } : {}),
        ...(input.sourceType ? { sourceType: input.sourceType } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'sourceStatBlockId')
          ? { sourceStatBlockId: input.sourceStatBlockId ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'initiative') ? { initiative: input.initiative ?? null } : {}),
        ...(typeof input.sortOrder === 'number' ? { sortOrder: input.sortOrder } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'maxHp') ? { maxHp: input.maxHp ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'currentHp') ? { currentHp: input.currentHp ?? null } : {}),
        ...(typeof input.tempHp === 'number' ? { tempHp: input.tempHp } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'armorClass') ? { armorClass: input.armorClass ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'speed') ? { speed: input.speed ?? null } : {}),
        ...(typeof input.isConcentrating === 'boolean' ? { isConcentrating: input.isConcentrating } : {}),
        ...(typeof input.deathSaveSuccesses === 'number' ? { deathSaveSuccesses: input.deathSaveSuccesses } : {}),
        ...(typeof input.deathSaveFailures === 'number' ? { deathSaveFailures: input.deathSaveFailures } : {}),
        ...(typeof input.isDefeated === 'boolean' ? { isDefeated: input.isDefeated } : {}),
        ...(typeof input.isHidden === 'boolean' ? { isHidden: input.isHidden } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      },
    })

    await appendEncounterEvent(
      encounterId,
      'ENCOUNTER',
      `Updated combatant ${updated.name}`,
      { schemaVersion: 1, action: 'combatant.update', combatantId: updated.id },
      userId,
    )

    return toEncounterCombatantDto(updated)
  }

  async deleteCombatant(
    encounterId: string,
    combatantId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const deleted = await prisma.encounterCombatant.deleteMany({
      where: { id: combatantId, encounterId },
    })

    if (!deleted.count) {
      throw apiError(404, 'NOT_FOUND', 'Combatant not found.')
    }

    await appendEncounterEvent(
      encounterId,
      'ENCOUNTER',
      'Removed combatant',
      { schemaVersion: 1, action: 'combatant.delete', combatantId },
      userId,
    )

    return { deleted: true }
  }

  async listEvents(encounterId: string, userId: string): Promise<EncounterEvent[]> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.read')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const events = await prisma.encounterEvent.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    })

    return events.map(toEncounterEventDto)
  }

  async createNoteEvent(
    encounterId: string,
    userId: string,
    input: EncounterEventNoteCreateInput,
  ): Promise<EncounterEvent> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const created = await prisma.encounterEvent.create({
      data: {
        encounterId,
        eventType: 'NOTE',
        summary: input.summary,
        payload: {
          schemaVersion: 1,
          ...(input.payload || {}),
        },
        createdByUserId: userId,
      },
    })

    return toEncounterEventDto(created)
  }
}
