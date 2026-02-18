import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export class SessionWorkspaceService {
  async getWorkspace(sessionId: string, userId: string, systemRole?: 'USER' | 'SYSTEM_ADMIN') {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId
      },
      include: {
        campaign: {
          select: {
            dungeonMasterName: true,
          },
        },
      },
    })

    if (!session) {
      return null
    }

    const accessResolution = await resolveCampaignAccess(session.campaignId, userId, systemRole)
    if (!accessResolution.access) {
      return null
    }

    const [recordings, recap, transcriptDoc, summaryDoc] = await Promise.all([
      prisma.recording.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recapRecording.findUnique({
        where: { sessionId },
      }),
      prisma.document.findFirst({
        where: { sessionId, type: 'TRANSCRIPT' },
        include: { currentVersion: true },
      }),
      prisma.document.findFirst({
        where: { sessionId, type: 'SUMMARY' },
        include: { currentVersion: true },
      }),
    ])

    return {
      session,
      recordings,
      recap,
      transcriptDoc,
      summaryDoc,
      access: accessResolution.access,
    }
  }
}
