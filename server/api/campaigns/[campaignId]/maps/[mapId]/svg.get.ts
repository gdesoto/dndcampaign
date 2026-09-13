import { sendStream, setHeader } from 'h3'
import { MapService } from '#server/services/map.service'
import { apiError, routeParams } from '#server/utils/http'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const { campaignId, mapId } = routeParams(event, 'campaignId', 'mapId')
  await requireCampaignPermission(event, campaignId, 'content.read')

  const result = await new MapService().getMapSvg(campaignId, mapId)
  if (!result) {
    throw apiError(404, 'NOT_FOUND', 'Map not found')
  }
  if (result.missing) {
    throw apiError(404, 'NOT_FOUND', 'No SVG source file found for this map')
  }

  setHeader(event, 'Content-Type', result.contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${result.filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  if (result.stream.size != null) {
    setHeader(event, 'Content-Length', result.stream.size)
  }
  return sendStream(event, result.stream.stream)
})
