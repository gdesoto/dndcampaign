import { prisma } from '#server/db/prisma'
import type { ServiceResult } from '#server/services/auth.service'
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
  ensureCampaignAccess,
  logEncounterActivity,
  toEncounterSummaryDto,
  toEncounterTemplateDto,
  validateEncounterCalendarLink,
  validateEncounterSessionLink,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export class EncounterTemplateService {
  async listTemplates(campaignId: string, userId: string): Promise<ServiceResult<EncounterTemplate[]>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.read')
    if (!access.ok) return access

    const templates = await prisma.encounterTemplate.findMany({
      where: { campaignId },
      include: { combatants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return { ok: true, data: templates.map(toEncounterTemplateDto) }
  }

  async createTemplate(
    campaignId: string,
    userId: string,
    input: EncounterTemplateCreateInput,
  ): Promise<ServiceResult<EncounterTemplate>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.write')
    if (!access.ok) return access

    const template = await prisma.encounterTemplate.create({
      data: {
        campaignId,
        name: input.name,
        type: input.type,
        notes: input.notes,
        createdByUserId: userId,
        combatants: {
          create: input.combatants.map((combatant) => ({
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
          })),
        },
      },
      include: { combatants: { orderBy: { sortOrder: 'asc' } } },
    })

    return { ok: true, data: toEncounterTemplateDto(template) }
  }

  async updateTemplate(
    templateId: string,
    userId: string,
    input: EncounterTemplateUpdateInput,
  ): Promise<ServiceResult<EncounterTemplate>> {
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id: templateId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter template not found or access denied.',
      }
    }

    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.encounterTemplate.update({
        where: { id: templateId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
        },
      })

      if (input.combatants) {
        await tx.encounterTemplateCombatant.deleteMany({ where: { templateId } })
        if (input.combatants.length) {
          await tx.encounterTemplateCombatant.createMany({
            data: input.combatants.map((combatant) => ({
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
            })),
          })
        }
      }

      return updated
    })

    const full = await prisma.encounterTemplate.findUnique({
      where: { id: template.id },
      include: { combatants: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!full) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter template not found.',
      }
    }

    return { ok: true, data: toEncounterTemplateDto(full) }
  }

  async deleteTemplate(templateId: string, userId: string): Promise<ServiceResult<{ deleted: true }>> {
    const existing = await prisma.encounterTemplate.findFirst({
      where: {
        id: templateId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter template not found or access denied.',
      }
    }

    await prisma.encounterTemplate.delete({ where: { id: templateId } })
    return { ok: true, data: { deleted: true } }
  }

  async instantiateTemplate(
    templateId: string,
    userId: string,
    input: EncounterTemplateInstantiateInput,
  ): Promise<ServiceResult<EncounterSummary>> {
    const template = await prisma.encounterTemplate.findFirst({
      where: {
        id: templateId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      include: { combatants: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!template) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter template not found or access denied.',
      }
    }

    const sessionValidation = await validateEncounterSessionLink(template.campaignId, input.sessionId)
    if (!sessionValidation.ok) return sessionValidation

    const calendarValidation = await validateEncounterCalendarLink(template.campaignId, {
      calendarYear: input.calendarYear,
      calendarMonth: input.calendarMonth,
      calendarDay: input.calendarDay,
    })
    if (!calendarValidation.ok) return calendarValidation

    const created = await prisma.$transaction(async (tx) => {
      const encounter = await tx.campaignEncounter.create({
        data: {
          campaignId: template.campaignId,
          name: input.name || template.name,
          type: template.type,
          notes: template.notes,
          sessionId: input.sessionId,
          calendarYear: calendarValidation.data.calendarYear,
          calendarMonth: calendarValidation.data.calendarMonth,
          calendarDay: calendarValidation.data.calendarDay,
          createdByUserId: userId,
        },
      })

      let sortOrder = 0
      for (const combatant of template.combatants) {
        for (let i = 0; i < combatant.quantity; i += 1) {
          await tx.encounterCombatant.create({
            data: {
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
            },
          })
          sortOrder += 1
        }
      }

      return encounter
    })

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

    return { ok: true, data: toEncounterSummaryDto(created) }
  }
}
