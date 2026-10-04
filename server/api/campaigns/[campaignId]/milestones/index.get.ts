import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq, asc, desc } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const milestones = await db.query.milestone.findMany({
    where: eq(tables.milestone.campaignId, campaignId),
    orderBy: [asc(tables.milestone.isComplete), desc(tables.milestone.createdAt)],
  })

  return ok(milestones)
})

