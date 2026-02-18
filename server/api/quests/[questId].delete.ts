import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const questId = event.context.params?.questId
  if (!questId) {
    return fail(400, 'VALIDATION_ERROR', 'Quest id is required')
  }

  const existing = await prisma.quest.findFirst({
    where: {
      id: questId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Quest not found')
  }

  await prisma.quest.delete({ where: { id: questId } })
  return ok({ success: true })
})

