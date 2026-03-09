import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const recapId = event.context.params?.recapId
  if (!recapId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Recap id is required')
  }

  const recap = await prisma.recapRecording.findUnique({
    where: { id: recapId },
    select: {
      artifactId: true,
      session: {
        select: {
          campaignId: true,
        },
      },
    },
  })
  if (!recap) {
    return fail(event, 404, 'NOT_FOUND', 'Recap not found')
  }

  const access = await requireCampaignPermission(event, recap.session.campaignId, 'content.read')
  if (!access.ok) {
    return access.response
  }

  const url = `/api/artifacts/${recap.artifactId}/stream`
  return ok({ url, expiresAt: null })
})
