import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const artifactId = event.context.params?.artifactId
  if (!artifactId) {
    return fail(400, 'VALIDATION_ERROR', 'Artifact id is required')
  }

  const artifact = await prisma.artifact.findFirst({
    where: { id: artifactId, ownerId: sessionUser.user.id },
  })
  if (!artifact) {
    return fail(404, 'NOT_FOUND', 'Artifact not found')
  }

  return ok(artifact)
})



