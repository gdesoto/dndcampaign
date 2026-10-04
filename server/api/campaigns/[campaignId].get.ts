import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  await requireCampaignPermission(event, campaignId, 'campaign.read')

  const campaign = await db.query.campaign.findFirst({ where: eq(tables.campaign.id, campaignId) }).sync()

  if (!campaign) {
    throw apiError(404, 'NOT_FOUND', 'Campaign not found')
  }

  return ok(campaign)
})

