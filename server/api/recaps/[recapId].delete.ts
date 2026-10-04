import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { ArtifactService } from '#server/services/artifact.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recapId } = routeParams(event, 'recapId')

  const recap =
    (await db.query.recapRecording.findFirst({
      where: eq(tables.recapRecording.id, recapId),
      columns: { id: true, artifactId: true },
      with: { session: { columns: { campaignId: true } } }
    })) ?? null
  if (!recap) {
    throw apiError(404, 'NOT_FOUND', 'Recap not found')
  }

  await requireCampaignPermission(
    event,
    recap.session.campaignId,
    'recording.upload'
  )

  const deletedRecap = (
    await db
      .delete(tables.recapRecording)
      .where(eq(tables.recapRecording.id, recap.id))
      .returning({ artifactId: tables.recapRecording.artifactId })
  )[0]!

  const service = new ArtifactService()
  try {
    await service.deleteArtifact(deletedRecap.artifactId)
  } catch {
    // Best-effort cleanup after recap row removal.
  }

  return ok({ success: true })
})
