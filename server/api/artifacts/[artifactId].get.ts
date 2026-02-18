import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const artifactId = event.context.params?.artifactId
  if (!artifactId) {
    return fail(400, 'VALIDATION_ERROR', 'Artifact id is required')
  }

  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  })
  if (!artifact) {
    return fail(404, 'NOT_FOUND', 'Artifact not found')
  }

  if (artifact.ownerId !== sessionUser.user.id) {
    if (!artifact.campaignId) {
      return fail(403, 'FORBIDDEN', 'Artifact access is denied')
    }

    const campaignAccess = await resolveCampaignAccess(
      artifact.campaignId,
      sessionUser.user.id,
      sessionUser.user.systemRole
    )
    const canRead = campaignAccess.access?.permissions.includes('content.read')
    if (!canRead) {
      return fail(403, 'FORBIDDEN', 'Artifact access is denied')
    }
  }

  return ok(artifact)
})



