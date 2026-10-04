import { getEncounterActions } from '#shared/utils/encounter-policy'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, inArray, asc, desc, count, max } from 'drizzle-orm'
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
    const encounters = db.query.campaignEncounter.findMany({where: and(eq(tables.campaignEncounter.campaignId, campaignId), buildEncounterVisibilityWhere(userId), query.status ? and(eq(tables.campaignEncounter.status, query.status)) : undefined, query.type ? and(eq(tables.campaignEncounter.type, query.type)) : undefined, query.sessionId ? and(eq(tables.campaignEncounter.sessionId, query.sessionId)) : undefined), orderBy: [desc(tables.campaignEncounter.updatedAt), desc(tables.campaignEncounter.createdAt)]}).sync()

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

    const created = db.insert(tables.campaignEncounter).values({
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
      }).returning().get()!

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
      ? db.query.encounterCondition.findMany({where: and(and(inArray(tables.encounterCondition.combatantId, combatantIds))), orderBy: [asc(tables.encounterCondition.createdAt)]}).sync()
      : []

    const detail = toEncounterDetailDto(encounter, conditions)
    const canWrite = db.select({ count: count() }).from(tables.campaignEncounter).where(and(eq(tables.campaignEncounter.id, encounterId), buildCampaignWhereForPermission(userId, 'content.write', tables.campaignEncounter.campaignId))).get()!.count
    detail.availableActions = getEncounterActions(encounter.status, encounter.combatants.length, Boolean(canWrite))
    return detail
  }

  async updateEncounter(
    encounterId: string,
    userId: string,
    input: EncounterUpdateInput,
  ): Promise<EncounterSummary> {
    const existing = db.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId), buildCampaignWhereForPermission(userId, 'content.write', tables.campaignEncounter.campaignId), buildEncounterVisibilityWhere(userId)), columns: {id: true, campaignId: true, status: true, sessionId: true, calendarYear: true, calendarMonth: true, calendarDay: true}}).sync()

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

    const updated = db.update(tables.campaignEncounter).set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.visibility ? { visibility: input.visibility } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'sessionId') ? { sessionId: input.sessionId ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarYear') ? { calendarYear: input.calendarYear ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarMonth') ? { calendarMonth: input.calendarMonth ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'calendarDay') ? { calendarDay: input.calendarDay ?? null } : {}),
      }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!

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
    const existing = db.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId), buildCampaignWhereForPermission(userId, 'content.write', tables.campaignEncounter.campaignId), buildEncounterVisibilityWhere(userId)), columns: {id: true}}).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter not found or access denied.')
    }

    const deleted = db.delete(tables.campaignEncounter).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!
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

    const combatants = db.query.encounterCombatant.findMany({where: and(eq(tables.encounterCombatant.encounterId, encounterId)), orderBy: [asc(tables.encounterCombatant.sortOrder), asc(tables.encounterCombatant.createdAt)]}).sync()

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
    return db.transaction( tx => {
      const current = tx.query.campaignEncounter.findFirst({where: and(eq(tables.campaignEncounter.id, encounterId))}).sync()!
      assertEncounterAction(current, 'participants')
      const last = tx.select({ sortOrder: max(tables.encounterCombatant.sortOrder) }).from(tables.encounterCombatant).where(and(eq(tables.encounterCombatant.encounterId, encounterId))).get()!
      const created: EncounterCombatant[] = []
      for (const [index, data] of prepared.entries()) {
        const row = tx.insert(tables.encounterCombatant).values({ ...data, encounterId, sortOrder: (last.sortOrder ?? -1) + index + 1 }).returning().get()!
        tx.insert(tables.encounterEvent).values({ encounterId, eventType: 'ENCOUNTER', summary: `Added participant ${row.name}`, payload: { schemaVersion: 1, action: 'combatant.create', combatantId: row.id }, createdByUserId: userId }).returning().get()!
        created.push(toEncounterCombatantDto(row))
      }
      return created
    }, { behavior: 'immediate' })
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

    const existing = db.query.encounterCombatant.findFirst({where: and(eq(tables.encounterCombatant.id, combatantId), eq(tables.encounterCombatant.encounterId, encounterId))}).sync()
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

    const updated = db.update(tables.encounterCombatant).set({
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
      }).where(and(eq(tables.encounterCombatant.id, combatantId))).returning().get()!

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
    const deleted = db.transaction( tx => {
      const result = tx.delete(tables.encounterCombatant).where(and(eq(tables.encounterCombatant.id, combatantId), eq(tables.encounterCombatant.encounterId, encounterId))).run()
      if (result.changes) tx.update(tables.campaignEncounter).set({
        currentTurnIndex: preservedIndex >= 0 ? preservedIndex : Math.max(0, Math.min(encounter.currentTurnIndex, remaining.length - 1)),
      }).where(and(eq(tables.campaignEncounter.id, encounterId))).returning().get()!
      return result
    }, { behavior: 'immediate' })

    if (!deleted.changes) {
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

    const events = db.query.encounterEvent.findMany({where: and(eq(tables.encounterEvent.encounterId, encounterId)), orderBy: [asc(tables.encounterEvent.createdAt)]}).sync()

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

    const created = db.insert(tables.encounterEvent).values({
        encounterId,
        eventType: 'NOTE',
        summary: input.summary,
        payload: {
          schemaVersion: 1,
          ...(input.payload || {}),
        },
        createdByUserId: userId,
      }).returning().get()!

    return toEncounterEventDto(created)
  }
}
