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
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  try {
    const { fields, files } = await readMapMultipartUpload(event)
    const created = await new MapService().createMapFromUpload(
      campaignId,
      authz.session.user.id,
      fields,
      files
    )
    if (!created) {
      return fail(404, 'NOT_FOUND', 'Campaign not found')
    }
    return ok(created)
  } catch (error) {
    const message = (error as Error).message || 'Map import failed'
    if (VALIDATION_MESSAGES.has(message)) {
      return fail(400, 'VALIDATION_ERROR', message)
    }
    throw error
  }
})
