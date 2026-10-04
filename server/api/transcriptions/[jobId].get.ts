import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const job =
    (await db.query.transcriptionJob.findFirst({
      where: and(
        eq(tables.transcriptionJob.id, jobId),
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
      with: { artifacts: { with: { artifact: true } } }
    })) ?? null

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription not found')
  }

  return ok(toTranscriptionJobDto(job))
})
