import { prisma } from '#server/db/prisma'
import type { Prisma } from '#server/db/prisma-client'
import type {
  EncounterStatBlock,
} from '#shared/types/encounter'
import type {
  EncounterStatBlockCreateInput,
  EncounterStatBlockUpdateInput,
} from '#shared/schemas/encounter'
import {
  toEncounterStatBlockDto,
} from '#server/services/encounter/encounter-shared'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { apiError } from '#server/utils/http'

export class EncounterStatBlockService {
  async listStatBlocks(campaignId: string): Promise<EncounterStatBlock[]> {
    const statBlocks = await prisma.encounterStatBlock.findMany({
      where: { campaignId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return statBlocks.map(toEncounterStatBlockDto)
  }

  async createStatBlock(
    campaignId: string,
    userId: string,
    input: EncounterStatBlockCreateInput,
  ): Promise<EncounterStatBlock> {
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

    return toEncounterStatBlockDto(created)
  }

  async updateStatBlock(
    statBlockId: string,
    userId: string,
    input: EncounterStatBlockUpdateInput,
  ): Promise<EncounterStatBlock> {
    const existing = await prisma.encounterStatBlock.findFirst({
      where: {
        id: statBlockId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter stat block not found or access denied.')
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

    return toEncounterStatBlockDto(updated)
  }

  async deleteStatBlock(statBlockId: string, userId: string): Promise<{ deleted: true }> {
    const existing = await prisma.encounterStatBlock.findFirst({
      where: {
        id: statBlockId,
        campaign: buildCampaignWhereForPermission(userId, 'content.write'),
      },
      select: { id: true },
    })

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter stat block not found or access denied.')
    }

    await prisma.encounterStatBlock.delete({ where: { id: statBlockId } })
    return { deleted: true }
  }
}

