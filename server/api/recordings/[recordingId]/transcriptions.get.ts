import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const jobs = await db.query.transcriptionJob.findMany({
    where: and(
      eq(tables.transcriptionJob.recordingId, recordingId),
      buildRecordingWhereForPermission(sessionUser.user.id, 'content.read', tables.transcriptionJob.recordingId)
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
