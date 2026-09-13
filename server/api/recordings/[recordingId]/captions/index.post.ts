import { getRequestHeader, readBody } from 'h3'
import { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readSingleFileUpload, streamToBuffer } from '#server/utils/multipart'
import { RecordingService } from '#server/services/recording.service'
import { toVtt } from '#shared/utils/transcript'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 2 * 1024 * 1024

const isCaptionFile = (filename: string, mimeType: string) => {
  const lower = filename.toLowerCase()
  return lower.endsWith('.vtt') || lower.endsWith('.srt') || mimeType === 'text/vtt' || mimeType === 'text/plain'
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
    },
    include: { session: true },
  })
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  let vttContent: string

  if (contentType.startsWith('multipart/form-data')) {
    const { result } = await readSingleFileUpload(event, {
      maxBytes: MAX_BYTES,
      maxFields: 5,
      accept: ({ filename, mimeType }) => isCaptionFile(filename, mimeType),
      consume: async (file) => (await streamToBuffer(file.stream)).toString('utf-8'),
    })
    vttContent = toVtt(result)
  } else {
    const body = (await readBody(event)) ?? {}
    const mode = typeof body === 'object' && body !== null && 'mode' in body ? (body as { mode?: unknown }).mode : 'from-transcript'
    if (mode !== 'from-transcript') {
      throw apiError(400, 'VALIDATION_ERROR', 'Invalid captions mode')
    }

    const transcript = await prisma.document.findFirst({
      where: { sessionId: recording.sessionId, type: 'TRANSCRIPT' },
      include: { currentVersion: true },
    })
    if (!transcript?.currentVersion?.content) {
      throw apiError(404, 'NOT_FOUND', 'Session transcript not found')
    }
    vttContent = toVtt(transcript.currentVersion.content)
  }

  await new RecordingService().attachVttFromStream({
    ownerId: sessionUser.user.id,
    campaignId: recording.session.campaignId,
    recordingId,
    filename: 'subtitles.vtt',
    mimeType: 'text/vtt',
    stream: Readable.from(vttContent),
  })

  return ok(await prisma.recording.findUnique({ where: { id: recordingId } }))
})
