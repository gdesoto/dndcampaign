import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readSingleFileUpload } from '#server/utils/multipart'
import { RecordingService } from '#server/services/recording.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

export default defineEventHandler(async (event) => {
  const { sessionId } = routeParams(event, 'sessionId')

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, campaignId: true },
  })
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const { actor } = await requireCampaignPermission(event, session.campaignId, 'recording.upload')

  const { result } = await readSingleFileUpload(event, {
    maxBytes: MAX_BYTES,
    accept: ({ mimeType }) => ALLOWED_MIME.has(mimeType),
    consume: (file, fields) => {
      const kindField = (fields.kind || '').toUpperCase()
      const kind = kindField === 'VIDEO' || kindField === 'AUDIO'
        ? kindField
        : file.mimeType.startsWith('video/') ? 'VIDEO' : 'AUDIO'
      const durationSeconds = Number(fields.durationSeconds)

      return new RecordingService().createRecordingFromStream({
        ownerId: actor.userId,
        campaignId: session.campaignId,
        sessionId,
        filename: file.filename,
        mimeType: file.mimeType,
        stream: file.stream,
        kind,
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
      })
    },
  })

  return ok(result)
})
