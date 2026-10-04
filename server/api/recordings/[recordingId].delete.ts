import { db } from '#server/db/client'
import * as tables from '#server/db/schema'
import { eq } from 'drizzle-orm'
import { RecordingService } from '#server/services/recording.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
import { ok, apiError, routeParams } from '#server/utils/http'

const recordingService = new RecordingService()

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { recordingId } = routeParams(event, 'recordingId')

  const recording =
    (await db.query.recording.findFirst({
      where: eq(tables.recording.id, recordingId),
      columns: { id: true },
      with: { session: { columns: { campaignId: true } } }
    })) ?? null

  if (!recording) {
    throw apiError(404, 'NOT_FOUND', 'Recording not found')
  }

  await requireCampaignPermission(
    event,
    recording.session.campaignId,
    'recording.upload'
  )

  await recordingService.deleteRecording(recording.id)
  return ok({ success: true })
})
