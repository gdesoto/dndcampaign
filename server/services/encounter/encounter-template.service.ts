import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import type {
  EncounterSummary,
  EncounterTemplate,
} from '#shared/types/encounter'
import type {
  EncounterTemplateCreateInput,
  EncounterTemplateInstantiateInput,
  EncounterTemplateUpdateInput,
} from '#shared/schemas/encounter'
import {
  appendEncounterEvent,
  logEncounterActivity,
  toEncounterSummaryDto,
  toEncounterTemplateDto,
  validateEncounterCalendarLink,
  validateEncounterSessionLink,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

export class EncounterTemplateService {
  async listTemplates(campaignId: string): Promise<EncounterTemplate[]> {
    const templates = db.query.encounterTemplate.findMany({where: and(eq(tables.encounterTemplate.campaignId, campaignId)), with: {combatants: {orderBy: [asc(tables.encounterTemplateCombatant.sortOrder)]}}, orderBy: [desc(tables.encounterTemplate.updatedAt), desc(tables.encounterTemplate.createdAt)]}).sync()

    return templates.map(toEncounterTemplateDto)
  }

  async createTemplate(
    campaignId: string,
    userId: string,
    input: EncounterTemplateCreateInput,
  ): Promise<EncounterTemplate> {
    const template = db.transaction(tx => {
      const row = tx.insert(tables.encounterTemplate).values({ campaignId, name: input.name, type: input.type, notes: input.notes, createdByUserId: userId }).returning().get()!
      if (input.combatants.length) tx.insert(tables.encounterTemplateCombatant).values(input.combatants.map(combatant => ({ ...combatant, templateId: row.id }))).run()
      return tx.query.encounterTemplate.findFirst({ where: eq(tables.encounterTemplate.id, row.id), with: { combatants: { orderBy: asc(tables.encounterTemplateCombatant.sortOrder) } } }).sync()!
    }, { behavior: 'immediate' })

    return toEncounterTemplateDto(template)
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    input: EncounterTemplateUpdateInput,
  ): Promise<EncounterTemplate> {
    const existing = db.query.encounterTemplate.findFirst({where: and(eq(tables.encounterTemplate.id, templateId), buildCampaignWhereForPermission(userId, 'content.write', tables.encounterTemplate.campaignId)), columns: {id: true}}).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter template not found or access denied.')
    }

    const template = db.transaction( (tx) => {
      const updateData = {
        ...(input.name ? { name: input.name } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      }
      if (Object.keys(updateData).length) {
        tx.update(tables.encounterTemplate).set(updateData).where(eq(tables.encounterTemplate.id, templateId)).run()
      }

      if (input.combatants) {
        tx.delete(tables.encounterTemplateCombatant).where(and(eq(tables.encounterTemplateCombatant.templateId, templateId))).run()
        if (input.combatants.length) {
          tx.insert(tables.encounterTemplateCombatant).values(input.combatants.map((combatant) => ({
              templateId,
              name: combatant.name,
              side: combatant.side,
              sourceType: combatant.sourceType,
              sourceStatBlockId: combatant.sourceStatBlockId,
              maxHp: combatant.maxHp,
              armorClass: combatant.armorClass,
              speed: combatant.speed,
              quantity: combatant.quantity,
              sortOrder: combatant.sortOrder,
              notes: combatant.notes,
            }))).run()
        }
      }

      return existing
    }, { behavior: 'immediate' })

    const full = db.query.encounterTemplate.findFirst({where: and(eq(tables.encounterTemplate.id, template.id)), with: {combatants: {orderBy: [asc(tables.encounterTemplateCombatant.sortOrder)]}}}).sync()

    if (!full) {
      throw apiError(404, 'NOT_FOUND', 'Encounter template not found.')
    }

    return toEncounterTemplateDto(full)
  }

  async deleteTemplate(templateId: string, userId: string): Promise<{ deleted: true }> {
    const existing = db.query.encounterTemplate.findFirst({where: and(eq(tables.encounterTemplate.id, templateId), buildCampaignWhereForPermission(userId, 'content.write', tables.encounterTemplate.campaignId)), columns: {id: true}}).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter template not found or access denied.')
    }

    db.delete(tables.encounterTemplate).where(and(eq(tables.encounterTemplate.id, templateId))).returning().get()!
    return { deleted: true }
  }

  async instantiateTemplate(
    templateId: string,
    userId: string,
    input: EncounterTemplateInstantiateInput,
  ): Promise<EncounterSummary> {
    const template = db.query.encounterTemplate.findFirst({where: and(eq(tables.encounterTemplate.id, templateId), buildCampaignWhereForPermission(userId, 'content.write', tables.encounterTemplate.campaignId)), with: {combatants: {orderBy: [asc(tables.encounterTemplateCombatant.sortOrder)]}}}).sync()

    if (!template) {
      throw apiError(404, 'NOT_FOUND', 'Encounter template not found or access denied.')
    }

    await validateEncounterSessionLink(template.campaignId, input.sessionId)

    const calendarValidation = await validateEncounterCalendarLink(template.campaignId, {
      calendarYear: input.calendarYear,
      calendarMonth: input.calendarMonth,
      calendarDay: input.calendarDay,
    })

    const created = db.transaction( (tx) => {
      const encounter = tx.insert(tables.campaignEncounter).values({
          campaignId: template.campaignId,
          name: input.name || template.name,
          type: template.type,
          notes: template.notes,
          sessionId: input.sessionId,
          calendarYear: calendarValidation.calendarYear,
          calendarMonth: calendarValidation.calendarMonth,
          calendarDay: calendarValidation.calendarDay,
          createdByUserId: userId,
        }).returning().get()!

      let sortOrder = 0
      for (const combatant of template.combatants) {
        for (let i = 0; i < combatant.quantity; i += 1) {
          tx.insert(tables.encounterCombatant).values({
              encounterId: encounter.id,
              name: combatant.quantity > 1 ? `${combatant.name} ${i + 1}` : combatant.name,
              side: combatant.side,
              sourceType: combatant.sourceType,
              sourceStatBlockId: combatant.sourceStatBlockId,
              maxHp: combatant.maxHp,
              currentHp: combatant.maxHp,
              armorClass: combatant.armorClass,
              speed: combatant.speed,
              sortOrder,
              notes: combatant.notes,
            }).returning().get()!
          sortOrder += 1
        }
      }

      return encounter
    }, { behavior: 'immediate' })

    await appendEncounterEvent(
      created.id,
      'ENCOUNTER',
      `Instantiated encounter from template ${template.name}`,
      { schemaVersion: 1, action: 'template.instantiate', templateId },
      userId,
    )
    await logEncounterActivity({
      actorUserId: userId,
      campaignId: template.campaignId,
      action: 'ENCOUNTER_TEMPLATE_INSTANTIATED',
      targetType: 'ENCOUNTER',
      targetId: created.id,
      summary: `Instantiated encounter "${created.name}" from template "${template.name}".`,
      metadata: {
        templateId,
      },
    })

    return toEncounterSummaryDto(created)
  }
}
