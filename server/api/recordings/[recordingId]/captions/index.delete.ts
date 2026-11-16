import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { ArtifactService } from '#server/services/artifact.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildRecordingWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording =
    (await db.query.recording.findFirst({
      where: and(
        eq(tables.recording.id, recordingId),
        buildRecordingWhereForPermission(sessionUser.user.id, 'document.edit')
      )
    })) ?? null
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const previousVttArtifactId = recording.vttArtifactId

  const updated = (
    await db
      .update(tables.recording)
      .set({ vttArtifactId: null })
      .where(eq(tables.recording.id, recordingId))
      .returning()
  )[0]!

  if (previousVttArtifactId) {
    const artifactService = new ArtifactService()
    try {
      await artifactService.deleteArtifact(previousVttArtifactId)
    } catch {
      // Best-effort cleanup after detaching subtitles.
    }
  }

  return ok(updated)
})
