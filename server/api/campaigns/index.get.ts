import { db } from '#server/db/client'
import { campaign } from '#server/db/schema'
import { and, desc, inArray } from 'drizzle-orm'
import { ok } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import { getApiAuth } from '#server/utils/api-auth'

export default defineEventHandler(async (event) => {
  const session = await requireApiUserSession(event)
  const auth = getApiAuth(event)
  const keyCampaignIds = auth?.kind === 'bearer' ? auth.key.campaigns.map((campaign) => campaign.campaignId) : undefined
  const campaigns = db.select().from(campaign).where(and(buildCampaignWhereForPermission(session.user.id, 'campaign.read'), keyCampaignIds ? inArray(campaign.id, keyCampaignIds) : undefined)).orderBy(desc(campaign.updatedAt)).all()
  return ok(campaigns)
})
