import { readBody } from 'h3'
import { z } from 'zod'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import {
  documentLinkRecordingSchema,
  documentRestoreSchema,
  documentUpdateSchema
} from '#shared/schemas/document'
import { DocumentService } from '#server/services/document.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

const documentPatchActionSchema = z.discriminatedUnion('action', [
  documentLinkRecordingSchema.extend({ action: z.literal('link-recording') }),
  documentRestoreSchema.extend({ action: z.literal('restore') })
])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { documentId } = routeParams(event, 'documentId')

  const rawBody = (await readBody(event)) ?? {}

  const existing =
    (await db.query.document.findFirst({
      where: and(
        eq(tables.document.id, documentId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'document.edit',
          tables.document.campaignId
        )
      )
    })) ?? null
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Document not found')
  }

  const actionParsed = documentPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.action === 'link-recording') {
      const recordingId = actionParsed.data.recordingId
      if (recordingId) {
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
            )
          })) ?? null
        if (!recording) {
          throw apiError(404, 'NOT_FOUND', 'Recording not found')
        }
      }

      const document = db.transaction((tx) => {
        tx.update(tables.document)
          .set({ recordingId: recordingId || null })
          .where(eq(tables.document.id, documentId))
          .run()
        return tx.query.document.findFirst({
          where: eq(tables.document.id, documentId),
          with: { currentVersion: true }
        }).sync() ?? null
      }, { behavior: 'immediate' })
      return ok(document)
    }

    const version =
      (await db.query.documentVersion.findFirst({
        where: and(
          eq(tables.documentVersion.id, actionParsed.data.versionId),
          eq(tables.documentVersion.documentId, documentId)
        )
      })) ?? null
    if (!version) {
      throw apiError(404, 'NOT_FOUND', 'Version not found')
    }

    const service = new DocumentService()
    const restored = await service.restoreVersion(documentId, version.id)
    return ok(restored)
  }

  const parsed = documentUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    throw apiError(400, 'VALIDATION_ERROR', 'Invalid document payload')
  }

  const service = new DocumentService()
  const updated = await service.updateDocument({
    documentId,
    content: parsed.data.content,
    format: parsed.data.format,
    source: 'USER_EDIT',
    createdByUserId: sessionUser.user.id
  })

  return ok(updated)
})
