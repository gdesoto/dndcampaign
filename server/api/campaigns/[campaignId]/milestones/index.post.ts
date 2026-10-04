import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import {  } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { milestoneCreateSchema } from '#shared/schemas/milestone'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, milestoneCreateSchema, 'Invalid milestone payload')

  const milestone = await db.insert(tables.milestone).values({
    campaignId,
    title: parsed.title,
    description: parsed.description,
  }).returning().get()

  return ok(milestone)
})

