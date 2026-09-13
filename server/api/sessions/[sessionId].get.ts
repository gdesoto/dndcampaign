import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { sessionId } = routeParams(event, 'sessionId')

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read'),
    },
    include: {
      campaign: {
        select: {
          dungeonMasterName: true,
        },
      },
    },
  })

  if (!session) {
    throw apiError(404, 'NOT_FOUND', 'Session not found')
  }

  return ok(session)
})

