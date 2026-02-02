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

