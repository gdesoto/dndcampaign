import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording = await prisma.recording.findFirst({
    where: {
      id: recordingId,
      session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') },
    },
    include: { session: true },
  })
  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  const history = await prisma.artifact.findMany({
    where: {
      campaignId: recording.session.campaignId,
      label: 'Transcript VTT',
      meta: {
        contains: `"recordingId":"${recordingId}"`,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (recording.vttArtifactId) {
    const current = await prisma.artifact.findUnique({
      where: { id: recording.vttArtifactId },
    })
    if (current && !history.find((item) => item.id === current.id)) {
      history.unshift(current)
    }
  }

  return ok(history)
})
