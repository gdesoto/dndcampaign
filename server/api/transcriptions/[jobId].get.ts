import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const job =
    (await db.query.transcriptionJob.findFirst({
      where: and(
        eq(tables.transcriptionJob.id, jobId),
        buildRecordingWhereForPermission(sessionUser.user.id, 'content.read', tables.transcriptionJob.recordingId)
      ),
      with: { artifacts: { with: { artifact: true } } }
    })) ?? null

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription not found')
  }

  return ok(toTranscriptionJobDto(job))
})
