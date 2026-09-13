import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { sessionCreateSchema } from '#shared/schemas/session'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, sessionCreateSchema, 'Invalid session payload')

  const created = await prisma.session.create({
    data: {
      campaignId,
      title: parsed.title,
      sessionNumber: parsed.sessionNumber,
      playedAt: parsed.playedAt ? new Date(parsed.playedAt) : undefined,
      notes: parsed.notes,
    },
  })

  return ok(created)
})

