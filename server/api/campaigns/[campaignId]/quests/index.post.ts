import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { questCreateSchema } from '#shared/schemas/quest'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
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
      status: parsed.data.status,
      progressNotes: parsed.data.progressNotes,
    },
  })

  return ok(quest)
})

