import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const jobs = await db.query.transcriptionJob.findMany({
    where: and(
      eq(tables.transcriptionJob.recordingId, recordingId),
      inArray(
        tables.transcriptionJob.recordingId,
        db
          .select({ id: tables.recording.id })
          .from(tables.recording)
          .where(
            inArray(
              tables.recording.sessionId,
              db
                .select({ id: tables.session.id })
                .from(tables.session)
                .where(
                  buildCampaignWhereForPermission(
                    sessionUser.user.id,
                    'content.read',
                    tables.session.campaignId
                  )
                )
            )
          )
      )
    ),
    orderBy: [desc(tables.transcriptionJob.createdAt)],
    with: {
      artifacts: {
        orderBy: [asc(tables.transcriptionArtifact.createdAt)],
        with: { artifact: true }
      }
    }
  })

  return ok(jobs.map(toTranscriptionJobDto))
})
