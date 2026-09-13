import { prisma } from '#server/db/prisma'
import { ArtifactService } from '#server/services/artifact.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

const artifactService = new ArtifactService()

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const { jobId, artifactId } = routeParams(event, 'jobId', 'artifactId')

  const job = await prisma.transcriptionJob.findFirst({
    where: {
      id: jobId,
      recording: {
        session: {
          campaign: buildCampaignWhereForPermission(sessionUser.user.id, 'recording.transcribe'),
        },
      },
      artifacts: {
        some: { artifactId },
      },
    },
    select: { id: true },
  })

  if (!job) {
    throw apiError(404, 'NOT_FOUND', 'Transcription artifact not found')
  }

  await prisma.transcriptionArtifact.deleteMany({
    where: {
      transcriptionJobId: job.id,
      artifactId,
    },
  })

  try {
    await artifactService.deleteArtifact(artifactId)
  } catch {
    // Best-effort cleanup after unlinking artifact from transcription job.
  }

  return ok({ success: true })
})
