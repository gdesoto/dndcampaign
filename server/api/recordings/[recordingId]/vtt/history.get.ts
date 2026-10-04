import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, desc, eq, inArray, like } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

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
                'content.read',
                tables.session.campaignId
              )
            )
        )
      ),
      with: { session: true }
    })) ?? null
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const history = await db.query.artifact.findMany({
    where: and(
      eq(tables.artifact.campaignId, recording.session.campaignId),
      eq(tables.artifact.label, 'Transcript VTT'),
      like(tables.artifact.meta, '%' + `"recordingId":"${recordingId}"` + '%')
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
