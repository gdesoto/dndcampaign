import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type { ServiceResult } from '#server/services/auth.service'
import type {
  EncounterStatBlock,
} from '#shared/types/encounter'
import type {
  EncounterStatBlockCreateInput,
  EncounterStatBlockUpdateInput,
} from '#shared/schemas/encounter'
import {
  ensureCampaignAccess,
  toEncounterStatBlockDto,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export class EncounterStatBlockService {
  async listStatBlocks(campaignId: string, userId: string): Promise<ServiceResult<EncounterStatBlock[]>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.read')
    if (!access.ok) return access

    const statBlocks = await prisma.encounterStatBlock.findMany({
      where: { campaignId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return { ok: true, data: statBlocks.map(toEncounterStatBlockDto) }
  }

  async createStatBlock(
    campaignId: string,
    userId: string,
    input: EncounterStatBlockCreateInput,
  ): Promise<ServiceResult<EncounterStatBlock>> {
    const access = await ensureCampaignAccess(campaignId, userId, 'content.write')
    if (!access.ok) return access

    const created = await prisma.encounterStatBlock.create({
      data: {
        campaignId,
        name: input.name,
        challengeRating: input.challengeRating,
        statBlockJson: input.statBlockJson as Prisma.InputJsonValue,
        notes: input.notes,
        createdByUserId: userId,
      },
    })

    return { ok: true, data: toEncounterStatBlockDto(created) }
  }

  async updateStatBlock(
    statBlockId: string,
    userId: string,
    input: EncounterStatBlockUpdateInput,
  ): Promise<ServiceResult<EncounterStatBlock>> {
    const existing = await prisma.encounterStatBlock.findFirst({
      where: {
        id: statBlockId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter stat block not found or access denied.',
      }
    }

    const updated = await prisma.encounterStatBlock.update({
      where: { id: statBlockId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'challengeRating')
          ? { challengeRating: input.challengeRating ?? null }
          : {}),
        ...(input.statBlockJson ? { statBlockJson: input.statBlockJson as Prisma.InputJsonValue } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      },
    })

    return { ok: true, data: toEncounterStatBlockDto(updated) }
  }

  async deleteStatBlock(statBlockId: string, userId: string): Promise<ServiceResult<{ deleted: true }>> {
    const existing = await prisma.encounterStatBlock.findFirst({
      where: {
        id: statBlockId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      return {
        ok: false,
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Encounter stat block not found or access denied.',
      }
    }

    await prisma.encounterStatBlock.delete({ where: { id: statBlockId } })
    return { ok: true, data: { deleted: true } }
  }
}

