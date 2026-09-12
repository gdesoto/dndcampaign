import { readBody } from 'h3'
import { z } from 'zod'
import { fail, respond } from '#server/utils/http'
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
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const rawBody = (await readBody(event)) ?? {}

  const sessionUser = await requireUserSession(event)

  const actionParsed = dungeonPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    switch (actionParsed.data.action) {
      case 'generate': {
        const result = await dungeonService.generateDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        return respond(event, result)
      }
      case 'regenerate': {
        const result = await dungeonService.regenerateDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        return respond(event, result)
      }
      case 'publish': {
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          'READY'
        )
        return respond(event, result)
      }
      case 'unpublish': {
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          'DRAFT'
        )
        return respond(event, result)
      }
      case 'export': {
        const result = await dungeonExportService.exportDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        return respond(event, result)
      }
      default:
        break
    }
  }

  const parsed = validateInput(event, dungeonUpdateSchema, rawBody, 'Invalid dungeon payload')
  if (!parsed.ok) return parsed.response

  const result = await dungeonService.updateDungeon(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  return respond(event, result)
})
