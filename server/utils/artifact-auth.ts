import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { apiError } from '#server/utils/http'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

const hasPublicRecapAccess = async (
  artifactId: string,
  campaignId: string,
  publicSlug: string
) => {
  const publicAccess =
    (await db.query.campaignPublicAccess.findFirst({
      where: and(
        eq(tables.campaignPublicAccess.campaignId, campaignId),
        eq(tables.campaignPublicAccess.publicSlug, publicSlug),
        eq(tables.campaignPublicAccess.isEnabled, true),
        eq(tables.campaignPublicAccess.showRecaps, true)
      ),
      columns: { campaignId: true }
    })) ?? null

  if (!publicAccess) {
    return false
  }

  const recap =
    (await db.query.recapRecording.findFirst({
      where: and(
        eq(tables.recapRecording.artifactId, artifactId),
        inArray(
          tables.recapRecording.sessionId,
          db
            .select({ id: tables.session.id })
            .from(tables.session)
            .where(eq(tables.session.campaignId, publicAccess.campaignId))
        )
      ),
      columns: { id: true }
    })) ?? null

  return Boolean(recap)
}

export const requireArtifactReadAccess = async (
  event: H3Event,
  artifactId: string
) => {
  const artifact =
    (await db.query.artifact.findFirst({
      where: eq(tables.artifact.id, artifactId)
    })) ?? null

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
      const canRead =
        campaignAccess.access?.permissions.includes('content.read')
      if (canRead) {
        return artifact
      }
    } else {
      const query = getQuery(event)
      const publicSlug =
        typeof query.publicSlug === 'string' && query.publicSlug.trim()
          ? query.publicSlug.trim()
          : ''
      if (publicSlug) {
        const canReadPublicly = await hasPublicRecapAccess(
          artifact.id,
          artifact.campaignId,
          publicSlug
        )
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

  if (
    artifact.ownerId !== sessionUser.id &&
    sessionUser.systemRole !== 'SYSTEM_ADMIN'
  ) {
    throw apiError(403, 'FORBIDDEN', 'Artifact access is denied')
  }

  return artifact
}
