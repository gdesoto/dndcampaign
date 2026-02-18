import { prisma } from '#server/db/prisma'
import { resolveCampaignAccess } from '#server/utils/campaign-auth'

export class CampaignWorkspaceService {
  async getWorkspace(
    campaignId: string,
    userId: string,
    sessionId?: string,
    systemRole?: 'USER' | 'SYSTEM_ADMIN'
  ) {
    const accessResolution = await resolveCampaignAccess(campaignId, userId, systemRole)
    if (!accessResolution.access) {
      return null
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
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
      access: accessResolution.access,
    }
  }
}
