import { mapReimportApplySchema } from '#shared/schemas/map'
import { readMapMultipartUpload } from '#server/services/map-upload.service'
import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

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

  try {
    const { files, fields } = await readMapMultipartUpload(event)
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
  } catch (error) {
    const message = (error as Error).message || 'Re-import apply failed'
    if (VALIDATION_MESSAGES.has(message)) {
      return fail(400, 'VALIDATION_ERROR', message)
    }
    throw error
  }
})
