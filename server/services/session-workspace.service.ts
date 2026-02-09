import { prisma } from '#server/db/prisma'

export class SessionWorkspaceService {
  async getWorkspace(sessionId: string, userId: string) {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        campaign: { ownerId: userId },
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
    }
  }
}
