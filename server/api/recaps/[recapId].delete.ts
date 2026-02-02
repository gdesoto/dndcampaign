import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { ArtifactService } from '#server/services/artifact.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recapId = event.context.params?.recapId
  if (!recapId) {
    return fail(400, 'VALIDATION_ERROR', 'Recap id is required')
  }

  const recap = await prisma.recapRecording.findFirst({
    where: { id: recapId, session: { campaign: { ownerId: sessionUser.user.id } } },
  })
  if (!recap) {
    return fail(404, 'NOT_FOUND', 'Recap not found')
  }

  const service = new ArtifactService()
  await service.deleteArtifact(recap.artifactId)
  await prisma.recapRecording.delete({ where: { id: recapId } })

  return ok({ success: true })
})
