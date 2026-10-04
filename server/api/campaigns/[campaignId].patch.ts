import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignUpdateSchema } from '#shared/schemas/campaign'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')
  const parsed = await validateBody(event, campaignUpdateSchema, 'Invalid campaign payload')
  await requireCampaignPermission(event, campaignId, 'campaign.settings.manage')

  const updated = await db.update(tables.campaign).set(parsed).where(eq(tables.campaign.id, campaignId)).returning().get()!

  return ok(updated)
})

