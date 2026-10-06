import { readBody } from 'h3'
import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { validateInput } from '#server/utils/validate'
import { encounterMapRoomUpdateSchema } from '#shared/schemas/encounter-map'
import { EncounterMapEditorService } from '#server/services/encounter-map/encounter-map-editor.service'

const encounterMapEditorService = new EncounterMapEditorService()
const encounterMapRoomActionSchema = z.object({
  action: z.literal('create-encounter'),
})

export default defineEventHandler(async (event) => {
  const { campaignId, encounterMapId, roomId } = routeParams(event, 'campaignId', 'encounterMapId', 'roomId')

  const rawBody = (await readBody(event)) ?? {}

  const { actor } = await requireCampaignPermission(event, campaignId, 'content.write')

  const actionParsed = encounterMapRoomActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const result = await encounterMapEditorService.createEncounterFromRoom(
      campaignId,
      encounterMapId,
      roomId,
      actor
    )
    return ok(result)
  }

  const parsed = validateInput(encounterMapRoomUpdateSchema, rawBody, 'Invalid room update payload')

  const result = await encounterMapEditorService.updateRoom(
    campaignId,
    encounterMapId,
    roomId,
    actor,
    parsed
  )
  return ok(result)
})
