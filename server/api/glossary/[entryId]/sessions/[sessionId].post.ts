import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { entryId, sessionId } = routeParams(event, 'entryId', 'sessionId')

  const entry = await prisma.glossaryEntry.findFirst({
    where: {
      id: entryId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!entry) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.write'),
    },
  })
  if (!session || session.campaignId !== entry.campaignId) {
    throw apiError(400, 'VALIDATION_ERROR', 'Session does not belong to campaign')
  }

  const link = await prisma.glossarySessionLink.upsert({
    where: {
      glossaryEntryId_sessionId: {
        glossaryEntryId: entryId,
        sessionId,
      },
    },
    update: {},
    create: {
      glossaryEntryId: entryId,
      sessionId,
    },
  })

  return ok(link)
})

