import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { ArtifactService } from '#server/services/artifact.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

const artifactService = new ArtifactService()

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId, artifactId } = routeParams(event, 'jobId', 'artifactId')

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
                      'recording.transcribe',
                      tables.session.campaignId
                    )
                  )
              )
            )
        ),
        inArray(
          tables.transcriptionJob.id,
          db
            .select({ id: tables.transcriptionArtifact.transcriptionJobId })
            .from(tables.transcriptionArtifact)
            .where(eq(tables.transcriptionArtifact.artifactId, artifactId))
        )
      ),
      columns: { id: true }
    })) ?? null

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription artifact not found')
  }

  await db
    .delete(tables.transcriptionArtifact)
    .where(
      and(
        eq(tables.transcriptionArtifact.transcriptionJobId, job.id),
        eq(tables.transcriptionArtifact.artifactId, artifactId)
      )
    )

  try {
    await artifactService.deleteArtifact(artifactId)
  } catch {
    // Best-effort cleanup after unlinking artifact from transcription job.
  }

  return ok({ success: true })
})
