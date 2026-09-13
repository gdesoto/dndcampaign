import { getRequestHeader, readBody } from 'h3'
import { z } from 'zod'
import { MapService } from '#server/services/map.service'
import { readMapMultipartUpload } from '#server/services/map-upload.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { mapPatchSchema, mapReimportApplySchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const mapPatchActionSchema = z.object({
  action: z.literal('set-primary'),
})

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (contentType.startsWith('multipart/form-data')) {
    const { files, fields } = await readMapMultipartUpload(event)
    const action = String(fields.action || '').trim()
    if (action === 'reimport-preview') {
      const preview = await new MapService().previewReimport(campaignId, mapId, files)
      if (!preview) {
        throw apiError(404, 'NOT_FOUND', 'Map not found')
      }
      return ok(preview)
    }

    if (action === 'reimport-apply') {
      const parsed = mapReimportApplySchema.safeParse({
        strategy: fields.strategy,
        mapName: fields.mapName,
        keepPrimary: fields.keepPrimary,
      })
      if (!parsed.success) {
        throw apiError(400, 'VALIDATION_ERROR', 'Invalid re-import apply payload')
      }

      const applied = await new MapService().applyReimport(
        campaignId,
        mapId,
        authz.session.user.id,
        parsed.data.strategy,
        files,
        parsed.data.mapName,
        parsed.data.keepPrimary
      )
      if (!applied) {
        throw apiError(404, 'NOT_FOUND', 'Map not found')
      }
      return ok(applied)
    }

    throw apiError(400, 'VALIDATION_ERROR', 'Invalid map action')
  }

  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = mapPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const updated = await new MapService().updateMap(campaignId, mapId, { isPrimary: true })
    if (!updated) {
      throw apiError(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(updated)
  }

  const parsed = mapPatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid map update payload')
  }

  const updated = await new MapService().updateMap(campaignId, mapId, parsed.data)
  if (!updated) {
    throw apiError(404, 'NOT_FOUND', 'Map not found')
  }

  return ok(updated)
})
