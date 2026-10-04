import { getQuery } from 'h3'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireApiUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session =
    (await db.query.session.findFirst({
      where: and(
        eq(tables.session.id, sessionId),
        buildCampaignWhereForPermission(
          sessionUser.user.id,
          'content.read',
          tables.session.campaignId
        )
      )
    })) ?? null
  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined

  if (type) {
    const document =
      (await db.query.document.findFirst({
        where: and(
          eq(tables.document.sessionId, sessionId),
          eq(tables.document.type, type as 'TRANSCRIPT' | 'SUMMARY' | 'NOTES')
        ),
        with: { currentVersion: true }
      })) ?? null
    return ok(document)
  }

  const documents = await db.query.document.findMany({
    where: eq(tables.document.sessionId, sessionId),
    orderBy: [desc(tables.document.updatedAt)],
    with: {
      currentVersion: {
        columns: {
          id: true,
          versionNumber: true,
          format: true,
          source: true,
          createdByUserId: true,
          createdAt: true
        }
      }
    }
  })
  return ok(documents)
})
