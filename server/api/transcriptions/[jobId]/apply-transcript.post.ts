import type { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { DocumentService } from '#server/services/document.service'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { transcriptionApplySchema } from '#shared/schemas/transcription'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const streamToBuffer = async (stream: Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const jobId = event.context.params?.jobId
  if (!jobId) {
    return fail(400, 'VALIDATION_ERROR', 'Transcription id is required')
  }

  const validation = await readValidatedBodySafe(event, transcriptionApplySchema)
  if (!validation.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid request', validation.fieldErrors)
  }

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') } },
    },
    include: {
      recording: { include: { session: true } },
      artifacts: { include: { artifact: true } },
    },
  })

  if (!job) {
    return fail(404, 'NOT_FOUND', 'Transcription not found')
  }

  const selected = validation.data.artifactId
    ? job.artifacts.find((entry) => entry.artifactId === validation.data.artifactId)
    : job.artifacts.find((entry) => entry.format === 'TXT')

  if (!selected) {
    return fail(404, 'NOT_FOUND', 'Transcript artifact not found')
  }

  const adapter = getStorageAdapter()
  const { stream } = await adapter.getObject(selected.artifact.storageKey)
  const buffer = await streamToBuffer(stream)
  const content = buffer.toString('utf-8')

  const service = new DocumentService()
  const existing = await prisma.document.findFirst({
    where: { sessionId: job.recording.sessionId, type: 'TRANSCRIPT' },
  })

  const titleBase = job.recording.session?.title
    ? `Transcript: ${job.recording.session.title}`
    : 'Transcript'

  const updated = existing
    ? await service.updateDocument({
        documentId: existing.id,
        content,
        format: 'PLAINTEXT',
        source: 'ELEVENLABS_IMPORT',
        createdByUserId: sessionUser.user.id,
      })
    : await service.createDocument({
        campaignId: job.recording.session.campaignId,
        sessionId: job.recording.sessionId,
        recordingId: job.recordingId,
        type: 'TRANSCRIPT',
        title: titleBase,
        content,
        format: 'PLAINTEXT',
        source: 'ELEVENLABS_IMPORT',
        createdByUserId: sessionUser.user.id,
      })

  if (existing && existing.recordingId !== job.recordingId) {
    await prisma.document.update({
      where: { id: existing.id },
      data: { recordingId: job.recordingId },
    })
  }

  return ok(updated)
})
