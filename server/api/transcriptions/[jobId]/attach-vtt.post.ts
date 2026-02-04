import { Readable } from 'node:stream'
import type { Readable as ReadableType } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { RecordingService } from '#server/services/recording.service'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { transcriptionAttachVttSchema } from '#shared/schemas/transcription'

const streamToBuffer = async (stream: ReadableType) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const srtToVtt = (input: string) => {
  const normalized = input.replace(/\r\n/g, '\n').trim()
  if (!normalized) return 'WEBVTT\n'
  const output: string[] = ['WEBVTT', '']
  const lines = normalized.split('\n')
  for (const line of lines) {
    if (/^\d+$/.test(line.trim())) continue
    output.push(line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'))
  }
  return `${output.join('\n').trim()}\n`
}

const normalizeVtt = (content: string) => {
  const trimmed = content.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return 'WEBVTT\n'
  if (/^WEBVTT/i.test(trimmed)) {
    return `${trimmed}\n`
  }
  return `WEBVTT\n\n${trimmed}\n`
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Transcription id is required')
  }

  const validation = await readValidatedBodySafe(event, transcriptionAttachVttSchema)
  if (!validation.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid request', validation.fieldErrors)
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: { ownerId: sessionUser.user.id } } },
    },
    include: {
      recording: { include: { session: { include: { campaign: true } } } },
      artifacts: { include: { artifact: true } },
    },
  })

  if (!job) {
    return fail(404, 'NOT_FOUND', 'Transcription not found')
  }

  const targetRecordingId = validation.data.recordingId || job.recordingId
  const targetRecording = await prisma.recording.findFirst({
    where: {
      id: targetRecordingId,
      sessionId: job.recording.sessionId,
      session: { campaign: { ownerId: sessionUser.user.id } },
    },
    include: { session: { include: { campaign: true } } },
  })

  if (!targetRecording) {
    return fail(404, 'NOT_FOUND', 'Recording not found')
  }

  if (targetRecording.kind !== 'VIDEO') {
    return fail(400, 'VALIDATION_ERROR', 'Subtitles can only be attached to video recordings')
  }

  const selected = job.artifacts.find((entry) => entry.artifactId === validation.data.artifactId)
  if (!selected || selected.format !== 'SRT') {
    return fail(404, 'NOT_FOUND', 'Subtitle artifact not found')
  }

  const adapter = getStorageAdapter()
  const { stream } = await adapter.getObject(selected.artifact.storageKey)
  const buffer = await streamToBuffer(stream)
  const content = buffer.toString('utf-8')
  const vttContent = content.trim().startsWith('WEBVTT') ? normalizeVtt(content) : srtToVtt(content)

  const service = new RecordingService()
  const updated = await service.attachVttFromStream({
    ownerId: targetRecording.session.campaign.ownerId,
    campaignId: targetRecording.session.campaignId,
    recordingId: targetRecording.id,
    filename: 'subtitles.vtt',
    mimeType: 'text/vtt',
    stream: Readable.from(vttContent),
  })

  return ok(updated)
})
