import { prisma } from '#server/db/prisma'
import { ArtifactService } from '#server/services/artifact.service'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'document.edit') },
    },
  })
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const previousVttArtifactId = recording.vttArtifactId

  const updated = await prisma.recording.update({
    where: { id: recordingId },
    data: { vttArtifactId: null },
  })

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
