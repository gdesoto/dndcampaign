import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { toTranscriptionJobDto } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId } = routeParams(event, 'jobId')

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: { session: { campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'content.read') } },
    },
    include: {
      artifacts: { include: { artifact: true } },
    },
  })

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription not found')
  }

  return ok(toTranscriptionJobDto(job))
})
