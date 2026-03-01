import { getQuery } from 'h3'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
  })
  if (!session) {
    return fail(404, 'NOT_FOUND', 'Session not found')
  }

  const query = getQuery(event)
  const type = typeof query.type === 'string' ? query.type : undefined

  if (type) {
    const document = await prisma.document.findFirst({
      where: { sessionId, type: type as 'TRANSCRIPT' | 'SUMMARY' | 'NOTES' },
      include: { currentVersion: true },
    })
    return ok(document)
  }

  const documents = await prisma.document.findMany({
    where: { sessionId },
    include: {
      currentVersion: {
        select: {
          id: true,
          versionNumber: true,
          format: true,
          source: true,
          createdByUserId: true,
          createdAt: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return ok(documents)
})
