//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { questUpdateSchema } from '#shared/schemas/quest'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const questId = event.context.params?.questId
  if (!questId) {
    return fail(400, 'VALIDATION_ERROR', 'Quest id is required')
  }

  const parsed = await readValidatedBodySafe(event, questUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid quest payload', parsed.fieldErrors)
  }

  const existing = await prisma.quest.findFirst({
    where: { id: questId, campaign: { ownerId: session.user.id } },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Quest not found')
  }

  const updated = await prisma.quest.update({
    where: { id: questId },
    data: parsed.data,
  })

  return ok(updated)
})
