import { readBody } from 'h3'
import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import { dungeonRoomUpdateSchema } from '#shared/schemas/dungeon'
import { DungeonEditorService } from '#server/services/dungeon/dungeon-editor.service'

const dungeonEditorService = new DungeonEditorService()
const dungeonRoomActionSchema = z.object({
  action: z.literal('create-encounter'),
})

export default defineEventHandler(async (event) => {
  const { campaignId, dungeonId, roomId } = routeParams(event, 'campaignId', 'dungeonId', 'roomId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')

  const actionParsed = dungeonRoomActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await dungeonEditorService.createEncounterFromRoom(
      campaignId,
      dungeonId,
      roomId,
      actor
    )
    return ok(result)
  }

  const parsed = validateInput(dungeonRoomUpdateSchema, rawBody, 'Invalid room update payload')

  const result = await dungeonEditorService.updateRoom(
    campaignId,
    dungeonId,
    roomId,
    actor,
    parsed
  )
  return ok(result)
})
