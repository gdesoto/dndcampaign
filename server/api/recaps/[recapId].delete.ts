import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { ArtifactService } from '#server/services/artifact.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const recapId = event.context.params?.recapId
  if (!recapId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Recap id is required')
  }

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
    return fail(event, 404, 'NOT_FOUND', 'Recap not found')
  }

  const access = await requireCampaignPermission(event, recap.session.campaignId, 'recording.upload')
  if (!access.ok) {
    return access.response
  }

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
