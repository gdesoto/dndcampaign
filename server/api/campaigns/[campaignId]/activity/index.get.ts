import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, and, ne, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const logs = await db.query.activityLog.findMany({
    where: and(eq(tables.activityLog.campaignId, campaignId), eq(tables.activityLog.scope, 'CAMPAIGN'), ne(tables.activityLog.action, 'API_KEY_WRITE_ATTEMPT')),
    orderBy: [desc(tables.activityLog.createdAt)],
    limit: 25,
    columns: {
      id: true,
      action: true,
      summary: true,
      createdAt: true
    }
  }).sync()

  return ok(
    logs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      summary: entry.summary,
      createdAt: entry.createdAt.toISOString(),
    })),
  )
})
