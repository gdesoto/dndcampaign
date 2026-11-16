import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { recordingVttArtifactsWhere } from '#server/services/recording.service'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording =
    (await db.query.recording.findFirst({
      where: and(
        eq(tables.recording.id, recordingId),
        buildRecordingWhereForPermission(sessionUser.user.id, 'content.read')
      ),
      with: { session: true }
    })) ?? null
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const history = await db.query.artifact.findMany({
    where: and(
      eq(tables.artifact.campaignId, recording.session.campaignId),
      recordingVttArtifactsWhere(recordingId)
    ),
    orderBy: [desc(tables.artifact.createdAt)]
  })

  if (recording.vttArtifactId) {
    const current =
      (await db.query.artifact.findFirst({
        where: eq(tables.artifact.id, recording.vttArtifactId)
      })) ?? null
    if (current && !history.find((item) => item.id === current.id)) {
      history.unshift(current)
    }
  }

  return ok(history)
})
