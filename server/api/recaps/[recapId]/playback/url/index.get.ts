import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const recapId = event.context.params?.recapId
  if (!recapId) {
    return fail(400, 'VALIDATION_ERROR', 'Recap id is required')
  }

  const recap = await prisma.recapRecording.findFirst({
    where: {
      id: recapId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') },
    },
  })
  if (!recap) {
    return fail(404, 'NOT_FOUND', 'Recap not found')
  }

  const url = `/api/artifacts/${recap.artifactId}/stream`
  return ok({ url, expiresAt: null })
})
