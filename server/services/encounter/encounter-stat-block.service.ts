import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { JsonValue } from '#server/db/columns'
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
    const statBlocks = db.query.encounterStatBlock.findMany({where: and(eq(tables.encounterStatBlock.campaignId, campaignId)), orderBy: [desc(tables.encounterStatBlock.updatedAt), desc(tables.encounterStatBlock.createdAt)]}).sync()

    return statBlocks.map(toEncounterStatBlockDto)
  }

  async createStatBlock(
    campaignId: string,
    userId: string,
    input: EncounterStatBlockCreateInput,
  ): Promise<EncounterStatBlock> {
    const created = db.insert(tables.encounterStatBlock).values({
        campaignId,
        name: input.name,
        challengeRating: input.challengeRating,
        statBlockJson: input.statBlockJson as JsonValue,
        notes: input.notes,
        createdByUserId: userId,
      }).returning().get()!

    return toEncounterStatBlockDto(created)
  }

  async updateStatBlock(
    statBlockId: string,
    userId: string,
    input: EncounterStatBlockUpdateInput,
  ): Promise<EncounterStatBlock> {
    const existing = db.query.encounterStatBlock.findFirst({where: and(eq(tables.encounterStatBlock.id, statBlockId), buildCampaignWhereForPermission(userId, 'content.write', tables.encounterStatBlock.campaignId)), columns: {id: true}}).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter stat block not found or access denied.')
    }

    const updated = db.update(tables.encounterStatBlock).set({
        ...(input.name ? { name: input.name } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'challengeRating')
          ? { challengeRating: input.challengeRating ?? null }
          : {}),
        ...(input.statBlockJson ? { statBlockJson: input.statBlockJson as JsonValue } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'notes') ? { notes: input.notes ?? null } : {}),
      }).where(and(eq(tables.encounterStatBlock.id, statBlockId))).returning().get()!

    return toEncounterStatBlockDto(updated)
  }

  async deleteStatBlock(statBlockId: string, userId: string): Promise<{ deleted: true }> {
    const existing = db.query.encounterStatBlock.findFirst({where: and(eq(tables.encounterStatBlock.id, statBlockId), buildCampaignWhereForPermission(userId, 'content.write', tables.encounterStatBlock.campaignId)), columns: {id: true}}).sync()

    if (!existing) {
      throw apiError(404, 'NOT_FOUND', 'Encounter stat block not found or access denied.')
    }

    db.delete(tables.encounterStatBlock).where(and(eq(tables.encounterStatBlock.id, statBlockId))).returning().get()!
    return { deleted: true }
  }
}

