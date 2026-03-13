import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { questUpdateSchema } from '#shared/schemas/quest'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { prisma } from '#server/db/prisma'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

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
    where: {
      id: questId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Quest not found')
  }

  const result = await questService.updateQuest(questId, parsed.data)
  if (!result.ok) {
    return fail(result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})

