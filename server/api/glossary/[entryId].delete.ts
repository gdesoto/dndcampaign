//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const entryId = event.context.params?.entryId
  if (!entryId) {
    return fail(400, 'VALIDATION_ERROR', 'Entry id is required')
  }

  const existing = await prisma.glossaryEntry.findFirst({
    where: { id: entryId, campaign: { ownerId: session.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  await prisma.glossaryEntry.delete({ where: { id: entryId } })
  return ok({ success: true })
})
