import { fail, respond } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { questUpdateSchema } from '#shared/schemas/quest'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { prisma } from '#server/db/prisma'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const questId = event.context.params?.questId
  if (!questId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Quest id is required')
  }

  const parsed = await validateBody(event, questUpdateSchema, 'Invalid quest payload')
  if (!parsed.ok) return parsed.response

  const existing = await prisma.quest.findFirst({
    where: {
      id: questId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(event, 404, 'NOT_FOUND', 'Quest not found')
  }

  const result = await questService.updateQuest(questId, parsed.data)
  return respond(event, result)
})

