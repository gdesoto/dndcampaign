import { getRequestHeader, readBody } from 'h3'
import { z } from 'zod'
import { MapService } from '#server/services/map.service'
import { readMapMultipartUpload } from '#server/services/map-upload.service'
import { ok, fail } from '#server/utils/http'
import { mapPatchSchema, mapReimportApplySchema } from '#shared/schemas/map'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const mapPatchActionSchema = z.object({
  action: z.literal('set-primary'),
})

const VALIDATION_MESSAGES = new Set([
  'Expected multipart form data',
  'File is too large',
  'Too many files uploaded',
  'Too many fields provided',
  'Full JSON export is required',
])

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (contentType.startsWith('multipart/form-data')) {
    try {
      const { files, fields } = await readMapMultipartUpload(event)
      const action = String(fields.action || '').trim()
      if (action === 'reimport-preview') {
        const preview = await new MapService().previewReimport(campaignId, mapId, authz.session.user.id, files)
        if (!preview) {
          return fail(404, 'NOT_FOUND', 'Map not found')
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
          return fail(400, 'VALIDATION_ERROR', 'Invalid re-import apply payload')
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
          return fail(404, 'NOT_FOUND', 'Map not found')
        }
        return ok(applied)
      }

      return fail(400, 'VALIDATION_ERROR', 'Invalid map action')
    } catch (error) {
      const message = (error as Error).message || 'Map re-import failed'
      if (VALIDATION_MESSAGES.has(message)) {
        return fail(400, 'VALIDATION_ERROR', message)
      }
      throw error
    }
  }

  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = mapPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    const updated = await new MapService().updateMap(campaignId, mapId, authz.session.user.id, { isPrimary: true })
    if (!updated) {
      return fail(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(updated)
  }

  const parsed = mapPatchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid map update payload')
  }

  const updated = await new MapService().updateMap(campaignId, mapId, authz.session.user.id, parsed.data)
  if (!updated) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }

  return ok(updated)
})
