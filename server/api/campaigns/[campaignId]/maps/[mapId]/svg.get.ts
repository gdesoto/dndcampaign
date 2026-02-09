import { sendStream, setHeader } from 'h3'
import { MapService } from '#server/services/map.service'
import { fail } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  const mapId = event.context.params?.mapId
  if (!campaignId || !mapId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id and map id are required')
  }

  const result = await new MapService().getMapSvg(campaignId, mapId, session.user.id)
  if (!result) {
    return fail(404, 'NOT_FOUND', 'Map not found')
  }
  if (result.missing) {
    return fail(404, 'NOT_FOUND', 'No SVG source file found for this map')
  }

  setHeader(event, 'Content-Type', result.contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${result.filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  if (result.stream.size != null) {
    setHeader(event, 'Content-Length', `${result.stream.size}`)
  }
  return sendStream(event, result.stream.stream)
})
