import { readBody } from 'h3'
import { z } from 'zod'
import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { mapGlossaryCommitSchema, mapGlossaryStageSchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const mapGlossaryActionSchema = z.discriminatedUnion('action', [
  mapGlossaryStageSchema.extend({ action: z.literal('stage') }),
  mapGlossaryCommitSchema.extend({ action: z.literal('commit') }),
])

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = mapGlossaryActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.action === 'stage') {
      const staged = await new MapService().stageGlossary(
        campaignId,
        mapId,
        authz.session.user.id,
        actionParsed.data.featureIds
      )
      if (!staged) {
        return fail(404, 'NOT_FOUND', 'Map not found')
      }
      return ok(staged)
    }

    const result = await new MapService().commitGlossary(
      campaignId,
      mapId,
      authz.session.user.id,
      actionParsed.data.items
    )
    if (!result) {
      return fail(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(result)
  }

  const stageParsed = mapGlossaryStageSchema.safeParse(rawBody)
  if (stageParsed.success) {
    const staged = await new MapService().stageGlossary(
      campaignId,
      mapId,
      authz.session.user.id,
      stageParsed.data.featureIds
    )
    if (!staged) {
      return fail(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(staged)
  }

  const commitParsed = mapGlossaryCommitSchema.safeParse(rawBody)
  if (commitParsed.success) {
    const result = await new MapService().commitGlossary(
      campaignId,
      mapId,
      authz.session.user.id,
      commitParsed.data.items
    )
    if (!result) {
      return fail(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(result)
  }

  return fail(400, 'VALIDATION_ERROR', 'Invalid map glossary payload')
})
