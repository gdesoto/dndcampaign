import { readMapMultipartUpload } from '#server/services/map-upload.service'
import { MapService } from '#server/services/map.service'
import { ok, fail } from '#server/utils/http'

const VALIDATION_MESSAGES = new Set([
  'Expected multipart form data',
  'File is too large',
  'Too many files uploaded',
  'Too many fields provided',
  'Full JSON export is required',
])

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  try {
    const { files } = await readMapMultipartUpload(event)
    const preview = await new MapService().previewReimport(campaignId, mapId, session.user.id, files)
    if (!preview) {
      return fail(404, 'NOT_FOUND', 'Map not found')
    }
    return ok(preview)
  } catch (error) {
    const message = (error as Error).message || 'Re-import preview failed'
    if (VALIDATION_MESSAGES.has(message)) {
      return fail(400, 'VALIDATION_ERROR', message)
    }
    throw error
  }
})
