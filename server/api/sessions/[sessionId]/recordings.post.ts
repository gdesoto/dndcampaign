import { getRequestHeader } from 'h3'
import Busboy from 'busboy'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { RecordingService } from '#server/services/recording.service'
import type { RecordingKind } from '#server/db/prisma-client'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const MAX_BYTES = 2 * 1024 * 1024 * 1024
const ALLOWED_MIME = [
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
]

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'recording.upload'),
    },
    include: { campaign: true },
  })
  if (!session) {
    return fail(404, 'NOT_FOUND', 'Session not found')
  }

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (!contentType.startsWith('multipart/form-data')) {
    return fail(400, 'VALIDATION_ERROR', 'Expected multipart form data')
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > MAX_BYTES) {
    return fail(400, 'VALIDATION_ERROR', 'File is too large')
  }

  let recording
  try {
    recording = await new Promise((resolve, reject) => {
      const busboy = Busboy({
        headers: event.node.req.headers,
        limits: {
        fileSize: MAX_BYTES,
        files: 1,
        fields: 10,
      },
    })

    let kindValue = ''
    let durationSeconds: number | undefined
    let fileHandled = false
    let fileError: string | null = null
    let uploadPromise: Promise<unknown> | null = null

    busboy.on('field', (name, value) => {
      if (name === 'kind') {
        kindValue = value.toUpperCase()
      }
      if (name === 'durationSeconds') {
        const parsed = Number(value)
        durationSeconds = Number.isFinite(parsed) ? parsed : undefined
      }
    })

    busboy.on('file', (name, file, info) => {
      if (name !== 'file') {
        file.resume()
        return
      }

      fileHandled = true

      const filename = info.filename
      const mimeType = info.mimeType || 'application/octet-stream'

      if (!filename) {
        fileError = 'File is required'
        file.resume()
        return
      }

      if (!ALLOWED_MIME.includes(mimeType)) {
        fileError = 'Unsupported file type'
        file.resume()
        return
      }

      file.on('limit', () => {
        fileError = 'File is too large'
        file.destroy(new Error('File is too large'))
        if (uploadPromise) {
          uploadPromise.catch(() => undefined)
        }
      })

      const kind =
        kindValue === 'VIDEO'
          ? 'VIDEO'
          : kindValue === 'AUDIO'
            ? 'AUDIO'
            : mimeType.startsWith('video/')
              ? 'VIDEO'
              : 'AUDIO'

      const service = new RecordingService()
      uploadPromise = service.createRecordingFromStream({
        ownerId: sessionUser.user.id,
        campaignId: session.campaignId,
        sessionId,
        filename,
        mimeType,
        stream: file,
        kind: kind as RecordingKind,
        durationSeconds,
      })
    })

    busboy.on('filesLimit', () => {
      fileError = 'Only one file is allowed'
    })

    busboy.on('error', (error) => {
      reject(error)
    })

    busboy.on('finish', async () => {
      if (fileError) {
        reject(new Error(fileError))
        return
      }
      if (!fileHandled || !uploadPromise) {
        reject(new Error('File is required'))
        return
      }
      try {
        const result = await uploadPromise
        resolve(result)
      } catch (error) {
        reject(error)
      }
    })

      event.node.req.pipe(busboy)
    })
  } catch (error) {
    const message = (error as Error & { message?: string }).message || 'Upload failed'
    if (
      message === 'File is too large' ||
      message === 'Unsupported file type' ||
      message === 'File is required' ||
      message === 'Only one file is allowed'
    ) {
      return fail(400, 'VALIDATION_ERROR', message)
    }
    throw error
  }

  return ok(recording)
})




