import { readBody } from 'h3'
import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { assertCampaignPermission, requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import {
  dungeonExportSchema,
  dungeonGenerateSchema,
  dungeonRegenerateSchema,
  dungeonUpdateSchema,
} from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'
import { DungeonExportService } from '#server/services/dungeon/dungeon-export.service'

const dungeonService = new DungeonService()
const dungeonExportService = new DungeonExportService()

const dungeonPatchActionSchema = z.discriminatedUnion('action', [
  dungeonGenerateSchema.extend({ action: z.literal('generate') }),
  dungeonRegenerateSchema.extend({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('unpublish') }),
  dungeonExportSchema.extend({ action: z.literal('export') }),
])

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId } = routeParams(event, 'campaignId', 'dungeonId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.read')

  const actionParsed = dungeonPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    switch (actionParsed.data.action) {
      case 'generate': {
        assertCampaignPermission(actor.access, 'content.write')
        const result = await dungeonService.generateDungeon(
          campaignId,
          dungeonId,
          actor,
          actionParsed.data
        )
        return ok(result)
      }
      case 'regenerate': {
        assertCampaignPermission(actor.access, 'content.write')
        const result = await dungeonService.regenerateDungeon(
          campaignId,
          dungeonId,
          actor,
          actionParsed.data
        )
        return ok(result)
      }
      case 'publish': {
        assertCampaignPermission(actor.access, 'campaign.public.manage')
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          actor,
          'READY'
        )
        return ok(result)
      }
      case 'unpublish': {
        assertCampaignPermission(actor.access, 'campaign.public.manage')
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          actor,
          'DRAFT'
        )
        return ok(result)
      }
      case 'export': {
        const result = await dungeonExportService.exportDungeon(
          campaignId,
          dungeonId,
          actor,
          actionParsed.data
        )
        return ok(result)
      }
      default:
        break
    }
  }

  assertCampaignPermission(actor.access, 'content.write')
  const parsed = validateInput(dungeonUpdateSchema, rawBody, 'Invalid dungeon payload')

  const result = await dungeonService.updateDungeon(campaignId, dungeonId, actor, parsed)
  return ok(result)
})
