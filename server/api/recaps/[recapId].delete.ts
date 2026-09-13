import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { ArtifactService } from '#server/services/artifact.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recapId } = routeParams(event, 'recapId')

  const recap = await prisma.recapRecording.findUnique({
    where: { id: recapId },
    select: {
      id: true,
      artifactId: true,
      session: {
        select: {
          campaignId: true,
        },
      },
    },
  })
  if (!recap) {
    throw apiError(404, 'NOT_FOUND', 'Recap not found')
  }

  await requireCampaignPermission(event, recap.session.campaignId, 'recording.upload')

  const deletedRecap = await prisma.recapRecording.delete({
    where: { id: recap.id },
    select: { artifactId: true },
  })

  const service = new ArtifactService()
  try {
    await service.deleteArtifact(deletedRecap.artifactId)
  } catch {
    // Best-effort cleanup after recap row removal.
  }

  return ok({ success: true })
})
