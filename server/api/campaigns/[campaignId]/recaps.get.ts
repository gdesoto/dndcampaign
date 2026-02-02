import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: sessionUser.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const recaps = await prisma.recapRecording.findMany({
    where: { session: { campaignId } },
    include: {
      session: {
        select: {
          id: true,
          title: true,
          sessionNumber: true,
          playedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(recaps)
})
