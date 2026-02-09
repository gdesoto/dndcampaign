import { prisma } from '#server/db/prisma'

export class CampaignWorkspaceService {
  async getWorkspace(campaignId: string, userId: string, sessionId?: string) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        ownerId: userId,
      },
      select: {
        id: true,
        name: true,
        system: true,
        dungeonMasterName: true,
      },
    })

    if (!campaign) {
      return null
    }

    let sessionHeader: {
      id: string
      title: string
      sessionNumber: number | null
      playedAt: Date | null
    } | null = null

    if (sessionId) {
      sessionHeader = await prisma.session.findFirst({
        where: {
          id: sessionId,
          campaignId,
          campaign: { ownerId: userId },
        },
        select: {
          id: true,
          title: true,
          sessionNumber: true,
          playedAt: true,
        },
      })
    }

    return {
      campaign,
      sessionHeader,
    }
  }
}
