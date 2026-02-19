import { getRequestHeader } from 'h3'
import Busboy from 'busboy'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { RecordingService } from '#server/services/recording.service'
import { Readable } from 'node:stream'
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

const srtToVtt = (input: string) => {
  const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!normalized) return 'WEBVTT\n'

  const lines = normalized.split('\n')
  const output: string[] = ['WEBVTT', '']
  const timePattern =
    /^(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})(.*)$/
  let pendingPrefix = ''

  for (let i = 0; i < lines.length; i += 1) {
    const currentLine = lines[i] ?? ''
    const line = currentLine.trim()
    if (!line) {
      pendingPrefix = ''
      output.push('')
      continue
    }
    if (/^\d+$/.test(line)) {
      continue
    }
    if (line.includes('-->')) {
      const match = line.match(timePattern)
      if (match) {
        const [, startBase, startMs, endBase, endMs, rest] = match
        const suffix = rest?.trim() || ''
        pendingPrefix = suffix
        output.push(`${startBase}.${startMs} --> ${endBase}.${endMs}`)
      } else {
        output.push(line.replace(/,/g, '.'))
      }
      continue
    }
    if (pendingPrefix) {
      output.push(`${pendingPrefix} ${currentLine.trim()}`.trim())
      pendingPrefix = ''
      continue
    }
    output.push(currentLine)
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n')
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recordingId = event.context.params?.recordingId
  if (!recordingId) {
    return fail(400, 'VALIDATION_ERROR', 'Recording id is required')
  }

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
    },
    include: { session: true },
  })
  if (!recording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  const contentType = String(getRequestHeader(event, 'content-type') || '')
  if (!contentType.startsWith('multipart/form-data')) {
    return fail(400, 'VALIDATION_ERROR', 'Expected multipart form data')
  }

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > MAX_BYTES) {
    return fail(400, 'VALIDATION_ERROR', 'File is too large')
  }

  let result
  try {
    result = await new Promise<{ recordingId: string }>((resolve, reject) => {
      const busboy = Busboy({
        headers: event.node.req.headers,
        limits: {
          fileSize: MAX_BYTES,
          files: 1,
          fields: 5,
        },
      })

      let fileHandled = false
      let fileError: string | null = null
      let uploadPromise: Promise<unknown> | null = null
      let isSrt = false
      const chunks: Buffer[] = []

      busboy.on('file', (name, file, info) => {
        if (name !== 'file') {
          file.resume()
          return
        }
        fileHandled = true
        const filename = info.filename || ''
        const mimeType = info.mimeType || 'application/octet-stream'
        if (!filename || !isCaptionFile(filename, mimeType)) {
          fileError = 'Unsupported file type'
          file.resume()
          return
        }
        const lowerName = filename.toLowerCase()
        isSrt = lowerName.endsWith('.srt')
        const finalMimeType = lowerName.endsWith('.vtt')
          ? 'text/vtt'
          : lowerName.endsWith('.srt')
            ? 'application/x-subrip'
            : mimeType === 'text/vtt'
              ? 'text/vtt'
              : 'text/plain'

        file.on('limit', () => {
          fileError = 'File is too large'
          file.destroy(new Error('File is too large'))
        })

        if (isSrt) {
          file.on('data', (data: Buffer) => {
            chunks.push(data)
          })
        } else {
          const service = new RecordingService()
          uploadPromise = service.attachVttFromStream({
            ownerId: sessionUser.user.id,
            campaignId: recording.session.campaignId,
            recordingId,
            filename,
            mimeType: finalMimeType,
            stream: file,
          })
        }
      })

      busboy.on('filesLimit', () => {
        fileError = 'Only one file is allowed'
      })

      busboy.on('error', (error) => {
        reject(error)
      })

      busboy.on('finish', () => {
        if (fileError) {
          reject(new Error(fileError))
          return
        }
        if (!fileHandled) {
          reject(new Error('File is required'))
          return
        }
        if (isSrt) {
          const service = new RecordingService()
          const srtContent = Buffer.concat(chunks).toString('utf-8')
          const vttContent = srtToVtt(srtContent)
          const vttStream = Readable.from(vttContent)
          uploadPromise = service.attachVttFromStream({
            ownerId: sessionUser.user.id,
            campaignId: recording.session.campaignId,
            recordingId,
            filename: 'subtitles.vtt',
            mimeType: 'text/vtt',
            stream: vttStream,
          })
        }
        if (!uploadPromise) {
          reject(new Error('Upload failed'))
          return
        }
        uploadPromise
          .then(() => resolve({ recordingId }))
          .catch((error) => reject(error))
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

  const updated = await prisma.recording.findUnique({ where: { id: result.recordingId } })
  return ok(updated)
})
