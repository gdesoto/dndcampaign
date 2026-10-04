import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readSingleFileUpload } from '#server/utils/multipart'
import { RecapService } from '#server/services/recap.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 512 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'video/ogg'
])

export default defineEventHandler(async (event) => {
  const { sessionId } = routeParams(event, 'sessionId')

  const session =
    (await db.query.session.findFirst({
      where: eq(tables.session.id, sessionId),
      columns: { id: true, campaignId: true }
    })) ?? null
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const { actor } = await requireCampaignPermission(
    event,
    session.campaignId,
    'recording.upload'
  )

  const { result } = await readSingleFileUpload(event, {
    maxBytes: MAX_BYTES,
    accept: ({ mimeType }) => ALLOWED_MIME.has(mimeType),
    consume: (file, fields) => {
      const durationSeconds = Number(fields.durationSeconds)
      return new RecapService().createRecapFromStream({
        ownerId: actor.userId,
        campaignId: session.campaignId,
        sessionId,
        filename: file.filename,
        mimeType: file.mimeType,
        stream: file.stream,
        durationSeconds: Number.isFinite(durationSeconds)
          ? durationSeconds
          : undefined
      })
    }
  })

  return ok(result)
})
