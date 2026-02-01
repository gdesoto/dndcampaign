//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { sessionCreateSchema } from '#shared/schemas/session'

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

  const parsed = await readValidatedBodySafe(event, sessionCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid session payload', parsed.fieldErrors)
  }

  const created = await prisma.session.create({
    data: {
      campaignId,
      title: parsed.data.title,
      sessionNumber: parsed.data.sessionNumber,
      playedAt: parsed.data.playedAt ? new Date(parsed.data.playedAt) : undefined,
      notes: parsed.data.notes,
    },
  })

  return ok(created)
})
