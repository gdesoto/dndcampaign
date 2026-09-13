import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { prisma } from '#server/db/prisma'
import { apiError } from '#server/utils/http'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

const hasPublicRecapAccess = async (artifactId: string, campaignId: string, publicSlug: string) => {
  const publicAccess = await prisma.campaignPublicAccess.findFirst({
    where: {
      campaignId,
      publicSlug,
      isEnabled: true,
      showRecaps: true,
    },
    select: {
      campaignId: true,
    },
  })

  if (!publicAccess) {
    return false
  }

  const recap = await prisma.recapRecording.findFirst({
    where: {
      artifactId,
      session: {
        campaignId: publicAccess.campaignId,
      },
    },
    select: { id: true },
  })

  return Boolean(recap)
}

export const requireArtifactReadAccess = async (event: H3Event, artifactId: string) => {
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  })

  if (!artifact) {
    throw apiError(404, 'NOT_FOUND', 'Artifact not found')
  }

  const session = await getUserSession(event)
  const sessionUser = session.user || null

  if (artifact.campaignId) {
    if (sessionUser) {
      const campaignAccess = await resolveCampaignAccess(
        artifact.campaignId,
        sessionUser.id,
        sessionUser.systemRole
      )
      const canRead = campaignAccess.access?.permissions.includes('content.read')
      if (canRead) {
        return artifact
      }
    } else {
      const query = getQuery(event)
      const publicSlug =
        typeof query.publicSlug === 'string' && query.publicSlug.trim() ? query.publicSlug.trim() : ''
      if (publicSlug) {
        const canReadPublicly = await hasPublicRecapAccess(artifact.id, artifact.campaignId, publicSlug)
        if (canReadPublicly) {
          return artifact
        }
      }
    }

    throw apiError(403, 'FORBIDDEN', 'Artifact access is denied')
  }

  if (!sessionUser) {
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  if (artifact.ownerId !== sessionUser.id && sessionUser.systemRole !== 'SYSTEM_ADMIN') {
    throw apiError(403, 'FORBIDDEN', 'Artifact access is denied')
  }

  return artifact
}
