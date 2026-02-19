import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { prisma } from '#server/db/prisma'
import { fail } from '#server/utils/http'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

type ArtifactReadResult =
  | {
      ok: true
      artifact: Awaited<ReturnType<typeof prisma.artifact.findUniqueOrThrow>>
    }
  | {
      ok: false
      response: ReturnType<typeof fail>
    }

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

export const requireArtifactReadAccess = async (
  event: H3Event,
  artifactId: string
): Promise<ArtifactReadResult> => {
  const artifact = await prisma.artifact.findUnique({
    where: { id: artifactId },
  })

  if (!artifact) {
    return { ok: false, response: fail(event, 404, 'NOT_FOUND', 'Artifact not found') }
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
        return { ok: true, artifact }
      }
    } else {
      const query = getQuery(event)
      const publicSlug =
        typeof query.publicSlug === 'string' && query.publicSlug.trim() ? query.publicSlug.trim() : ''
      if (publicSlug) {
        const canReadPublicly = await hasPublicRecapAccess(artifact.id, artifact.campaignId, publicSlug)
        if (canReadPublicly) {
          return { ok: true, artifact }
        }
      }
    }

    return { ok: false, response: fail(event, 403, 'FORBIDDEN', 'Artifact access is denied') }
  }

  if (!sessionUser) {
    return { ok: false, response: fail(event, 401, 'UNAUTHORIZED', 'Not authenticated') }
  }

  if (artifact.ownerId !== sessionUser.id && sessionUser.systemRole !== 'SYSTEM_ADMIN') {
    return { ok: false, response: fail(event, 403, 'FORBIDDEN', 'Artifact access is denied') }
  }

  return { ok: true, artifact }
}
