import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { sessionCreateSchema } from '#shared/schemas/session'
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

