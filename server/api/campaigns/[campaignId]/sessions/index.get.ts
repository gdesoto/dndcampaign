import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { asc, desc, eq } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const sessions = await db.query.session.findMany({
    where: eq(tables.session.campaignId, campaignId),
    orderBy: [
      asc(tables.session.sessionNumber),
      desc(tables.session.playedAt),
      desc(tables.session.createdAt)
    ]
  })

  return ok(sessions)
})
