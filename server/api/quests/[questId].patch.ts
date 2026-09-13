import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { questUpdateSchema } from '#shared/schemas/quest'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { prisma } from '#server/db/prisma'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { questId } = routeParams(event, 'questId')

  const parsed = await validateBody(event, questUpdateSchema, 'Invalid quest payload')

  const existing = await prisma.quest.findFirst({
    where: {
      id: questId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Quest not found')
  }

  const result = await questService.updateQuest(questId, parsed)
  return ok(result)
})

