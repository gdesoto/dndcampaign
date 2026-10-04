import { getRequestHeader, readBody } from 'h3'
import { Readable } from 'node:stream'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { readSingleFileUpload, streamToBuffer } from '#server/utils/multipart'
import { RecordingService } from '#server/services/recording.service'
import { toVtt } from '#shared/utils/transcript'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 2 * 1024 * 1024

const isCaptionFile = (filename: string, mimeType: string) => {
  const lower = filename.toLowerCase()
  return (
    lower.endsWith('.vtt') ||
    lower.endsWith('.srt') ||
    mimeType === 'text/vtt' ||
    mimeType === 'text/plain'
  )
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording =
    (await db.query.recording.findFirst({
      where: and(
        eq(tables.recording.id, recordingId),
        inArray(
          tables.recording.sessionId,
          db
            .select({ id: tables.session.id })
            .from(tables.session)
            .where(
              buildCampaignWhereForPermission(
                sessionUser.user.id,
                'document.edit',
                tables.session.campaignId
              )
            )
        )
      ),
      with: { session: true }
    })) ?? null
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
      consume: async (file) =>
        (await streamToBuffer(file.stream)).toString('utf-8')
    })
    vttContent = toVtt(result)
  } else {
    const body = (await readBody(event)) ?? {}
    const mode =
      typeof body === 'object' && body !== null && 'mode' in body
        ? (body as { mode?: unknown }).mode
        : 'from-transcript'
    if (mode !== 'from-transcript') {
      throw apiError(400, 'VALIDATION_ERROR', 'Invalid captions mode')
    }

    const transcript =
      (await db.query.document.findFirst({
        where: and(
          eq(tables.document.sessionId, recording.sessionId),
          eq(tables.document.type, 'TRANSCRIPT')
        ),
        with: { currentVersion: true }
      })) ?? null
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
    stream: Readable.from(vttContent)
  })

  return ok(
    (await db.query.recording.findFirst({
      where: eq(tables.recording.id, recordingId)
    })) ?? null
  )
})
