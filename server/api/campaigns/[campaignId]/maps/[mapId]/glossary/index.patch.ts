import { readBody } from 'h3'
import { z } from 'zod'
import { MapService } from '#server/services/map.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { mapGlossaryCommitSchema, mapGlossaryStageSchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const mapGlossaryActionSchema = z.discriminatedUnion('action', [
  mapGlossaryStageSchema.extend({ action: z.literal('stage') }),
  mapGlossaryCommitSchema.extend({ action: z.literal('commit') }),
])

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  await requireCampaignPermission(event, campaignId, 'content.write')

  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = mapGlossaryActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.action === 'stage') {
      const staged = await new MapService().stageGlossary(
        campaignId,
        mapId,
        actionParsed.data.featureIds
      )
      if (!staged) {
        throw apiError(404, 'NOT_FOUND', 'Map not found')
      }
      return ok(staged)
    }

    const result = await new MapService().commitGlossary(
      campaignId,
      mapId,
      actionParsed.data.items
    )
    if (!result) {
      throw apiError(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(result)
  }

  const stageParsed = mapGlossaryStageSchema.safeParse(rawBody)
  if (stageParsed.success) {
    const staged = await new MapService().stageGlossary(
      campaignId,
      mapId,
      stageParsed.data.featureIds
    )
    if (!staged) {
      throw apiError(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(staged)
  }

  const commitParsed = mapGlossaryCommitSchema.safeParse(rawBody)
  if (commitParsed.success) {
    const result = await new MapService().commitGlossary(
      campaignId,
      mapId,
      commitParsed.data.items
    )
    if (!result) {
      throw apiError(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(result)
  }

  throw apiError(400, 'VALIDATION_ERROR', 'Invalid map glossary payload')
})
