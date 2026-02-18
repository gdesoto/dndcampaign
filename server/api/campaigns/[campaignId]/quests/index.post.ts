import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { questCreateSchema } from '#shared/schemas/quest'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) {
    return authz.response
  }

  const parsed = await readValidatedBodySafe(event, questCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid quest payload', parsed.fieldErrors)
  }

  const quest = await prisma.quest.create({
    data: {
      campaignId,
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
      status: parsed.data.status,
      progressNotes: parsed.data.progressNotes,
    },
  })

  return ok(quest)
})

