import { getEncounterActions } from '#shared/utils/encounter-policy'
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
  assertEncounterAction,
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
  buildEncounterVisibilityWhere,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

export class EncounterService {
  async listEncounters(campaignId: string, userId: string, query: EncounterListQueryInput): Promise<EncounterSummary[]> {
    const encounters = await prisma.campaignEncounter.findMany({
      where: {
        campaignId,
        ...buildEncounterVisibilityWhere(userId),
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

    const detail = toEncounterDetailDto(encounter, conditions)
    const canWrite = await prisma.campaignEncounter.count({ where: { id: encounterId, campaign: buildCampaignWhereForPermission(userId, 'content.write') } })
    detail.availableActions = getEncounterActions(encounter.status, encounter.combatants.length, Boolean(canWrite))
    return detail
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
        ...buildEncounterVisibilityWhere(userId),
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

    assertEncounterAction(existing, 'edit')

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

    const updated = await prisma.campaignEncounter.update({
      where: { id: encounterId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'sessionId') ? { sessionId: input.sessionId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarYear') ? { calendarYear: input.calendarYear ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarMonth') ? { calendarMonth: input.calendarMonth ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarDay') ? { calendarDay: input.calendarDay ?? null } : {}),
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
        ...buildEncounterVisibilityWhere(userId),
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

  async createCombatant(encounterId: string, userId: string, input: EncounterCombatantCreateInput): Promise<EncounterCombatant> {
    return (await this.createCombatants(encounterId, userId, [input]))[0]!
  }

  async createCombatants(encounterId: string, userId: string, inputs: EncounterCombatantCreateInput[]): Promise<EncounterCombatant[]> {
    const encounter = await getEncounterWithAccess(encounterId, userId, 'content.write')
    if (!encounter) throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    assertEncounterAction(encounter, 'participants')
    const prepared = await Promise.all(inputs.map(async input => {
      const defaults = await validateEncounterCombatantSourceReferences(encounter.campaignId, input)
      return {
        ...input,
        maxHp: input.maxHp ?? defaults.maxHp,
        currentHp: input.currentHp ?? input.maxHp ?? defaults.currentHp ?? defaults.maxHp,
        armorClass: input.armorClass ?? defaults.armorClass,
        speed: input.speed ?? defaults.speed,
      }
    }))
    return prisma.$transaction(async tx => {
      const current = await tx.campaignEncounter.findUniqueOrThrow({ where: { id: encounterId } })
      assertEncounterAction(current, 'participants')
      const last = await tx.encounterCombatant.aggregate({ where: { encounterId }, _max: { sortOrder: true } })
      const created: EncounterCombatant[] = []
      for (const [index, data] of prepared.entries()) {
        const row = await tx.encounterCombatant.create({ data: { ...data, encounterId, sortOrder: (last._max.sortOrder ?? -1) + index + 1 } })
        await tx.encounterEvent.create({ data: { encounterId, eventType: 'ENCOUNTER', summary: `Added participant ${row.name}`, payload: { schemaVersion: 1, action: 'combatant.create', combatantId: row.id }, createdByUserId: userId } })
        created.push(toEncounterCombatantDto(row))
      }
      return created
    })
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
    assertEncounterAction(encounter, 'participants')

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
    assertEncounterAction(encounter, 'participants')

    const ordered = [...encounter.combatants].sort((a, b) => a.sortOrder - b.sortOrder)
    const previousActiveId = ordered[encounter.currentTurnIndex]?.id
    const remaining = ordered.filter(item => item.id !== combatantId)
    const preservedIndex = remaining.findIndex(item => item.id === previousActiveId)
    const deleted = await prisma.$transaction(async tx => {
      const result = await tx.encounterCombatant.deleteMany({ where: { id: combatantId, encounterId } })
      if (result.count) await tx.campaignEncounter.update({ where: { id: encounterId }, data: {
        currentTurnIndex: preservedIndex >= 0 ? preservedIndex : Math.max(0, Math.min(encounter.currentTurnIndex, remaining.length - 1)),
      } })
      return result
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
    assertEncounterAction(encounter, 'notes')

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
