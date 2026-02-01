//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { glossaryUpdateSchema } from '#shared/schemas/glossary'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const entryId = event.context.params?.entryId
  if (!entryId) {
    return fail(400, 'VALIDATION_ERROR', 'Entry id is required')
  }

  const parsed = await readValidatedBodySafe(event, glossaryUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary payload', parsed.fieldErrors)
  }

  const existing = await prisma.glossaryEntry.findFirst({
    where: { id: entryId, campaign: { ownerId: session.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const updated = await prisma.glossaryEntry.update({
    where: { id: entryId },
    data: parsed.data,
  })

  return ok(updated)
})
