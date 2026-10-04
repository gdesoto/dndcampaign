import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { questUpdateSchema } from '#shared/schemas/quest'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { and, eq } from 'drizzle-orm'
import { QuestService } from '#server/services/quest.service'

const questService = new QuestService()

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const { questId } = routeParams(event, 'questId')

  const parsed = await validateBody(event, questUpdateSchema, 'Invalid quest payload')

  const existing = await db.query.quest.findFirst({
    where: and(
      eq(tables.quest.id, questId),
      buildCampaignWhereForPermission(session.user.id, 'content.write', tables.quest.campaignId),
    ),
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Quest not found')
  }

  const result = await questService.updateQuest(questId, parsed)
  return ok(result)
})

