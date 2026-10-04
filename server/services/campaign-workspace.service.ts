import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and } from 'drizzle-orm'
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

    const campaign = await db.query.campaign.findFirst({
      where: eq(tables.campaign.id, campaignId),
      columns: {
        id: true,
        name: true,
        system: true,
        dungeonMasterName: true
      }
    }).sync()

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
      sessionHeader = await db.query.session.findFirst({
        where: and(eq(tables.session.id, sessionId), eq(tables.session.campaignId, campaignId)),
        columns: {
          id: true,
          title: true,
          sessionNumber: true,
          playedAt: true
        }
      }).sync() ?? null
    }

    return {
      campaign,
      sessionHeader,
      access: accessResolution.access,
    }
  }
}
