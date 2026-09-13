import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const jobs = await prisma.transcriptionJob.findMany({
    where: {
      recordingId,
      recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') } },
    },
    include: {
      artifacts: {
        include: { artifact: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(jobs.map(toTranscriptionJobDto))
})
