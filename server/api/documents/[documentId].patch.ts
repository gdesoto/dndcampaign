import { readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { documentLinkRecordingSchema, documentRestoreSchema, documentUpdateSchema } from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const documentPatchActionSchema = z.discriminatedUnion('action', [
  documentLinkRecordingSchema.extend({ action: z.literal('link-recording') }),
  documentRestoreSchema.extend({ action: z.literal('restore') }),
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const documentId = event.context.params?.documentId
  if (!documentId) {
    return fail(400, 'VALIDATION_ERROR', 'Document id is required')
  }

  const rawBody = (await readBody(event)) ?? {}

  const existing = await prisma.document.findFirst({
    where: {
      id: documentId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Document not found')
  }

  const actionParsed = documentPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.action === 'link-recording') {
      const recordingId = actionParsed.data.recordingId
      if (recordingId) {
        const recording = await prisma.recording.findFirst({
          where: {
            id: recordingId,
            session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
          },
        })
        if (!recording) {
          return fail(404, 'NOT_FOUND', 'Recording not found')
        }
      }

      const updated = await prisma.document.update({
        where: { id: documentId },
        data: { recordingId: recordingId || null },
        include: { currentVersion: true },
      })

      return ok(updated)
    }

    const version = await prisma.documentVersion.findFirst({
      where: { id: actionParsed.data.versionId, documentId },
    })
    if (!version) {
      return fail(404, 'NOT_FOUND', 'Version not found')
    }

    const service = new DocumentService()
    const restored = await service.restoreVersion(documentId, version.id)
    return ok(restored)
  }

  const parsed = documentUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid document payload')
  }

  const service = new DocumentService()
  const updated = await service.updateDocument({
    documentId,
    content: parsed.data.content,
    format: parsed.data.format,
    source: 'USER_EDIT',
    createdByUserId: sessionUser.user.id,
  })

  return ok(updated)
})
