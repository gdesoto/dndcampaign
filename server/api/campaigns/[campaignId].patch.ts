import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignUpdateSchema } from '#shared/schemas/campaign'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId

  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const parsed = await readValidatedBodySafe(event, campaignUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid campaign payload', parsed.fieldErrors)
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })

  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: parsed.data,
  })

  return ok(updated)
})

