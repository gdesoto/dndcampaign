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

  const existing = await prisma.glossarySessionLink.findUnique({
    where: {
      glossaryEntryId_sessionId: {
        glossaryEntryId: entryId,
        sessionId,
      },
    },
  })
  if (!existing) {
    return ok({ success: true })
  }

  await prisma.glossarySessionLink.delete({
    where: {
      glossaryEntryId_sessionId: {
        glossaryEntryId: entryId,
        sessionId,
      },
    },
  })

  return ok({ success: true })
})

