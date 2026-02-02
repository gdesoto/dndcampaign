import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const entryId = event.context.params?.entryId
  const sessionId = event.context.params?.sessionId
  if (!entryId || !sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Entry id and session id are required')
  }

  const entry = await prisma.glossaryEntry.findFirst({
    where: { id: entryId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!entry) {
    return fail(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, campaign: { ownerId: sessionUser.user.id } },
  })
  if (!session || session.campaignId !== entry.campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Session does not belong to campaign')
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

