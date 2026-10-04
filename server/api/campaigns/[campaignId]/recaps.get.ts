import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { desc, eq, inArray } from 'drizzle-orm'
import { ok, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.read')

  const recaps = await db.query.recapRecording.findMany({
    where: inArray(
      tables.recapRecording.sessionId,
      db
        .select({ id: tables.session.id })
        .from(tables.session)
        .where(eq(tables.session.campaignId, campaignId))
    ),
    orderBy: [desc(tables.recapRecording.createdAt)],
    with: {
      session: {
        columns: { id: true, title: true, sessionNumber: true, playedAt: true }
      }
    }
  })

  return ok(recaps)
})
