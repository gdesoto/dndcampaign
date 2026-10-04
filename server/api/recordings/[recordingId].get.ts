import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { ok, apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recordingAccess =
    (await db.query.recording.findFirst({
      where: eq(tables.recording.id, recordingId),
      columns: {},
      with: { session: { columns: { campaignId: true } } }
    })) ?? null
  if (!recordingAccess) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  await requireCampaignPermission(
    event,
    recordingAccess.session.campaignId,
    'content.read'
  )

  const recording =
    (await db.query.recording.findFirst({
      where: eq(tables.recording.id, recordingId)
    })) ?? null

  return ok(recording)
})
