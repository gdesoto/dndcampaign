import { sendStream, setHeader } from 'h3'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'
import { routeParams } from '#server/utils/http'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug, mapSlug } = routeParams(event, 'publicSlug', 'mapSlug')

  const result = await publicAccessService.getPublicMapSvg(publicSlug, mapSlug)

  setHeader(event, 'Content-Type', result.contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${result.filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  if (result.stream.size != null) {
    setHeader(event, 'Content-Length', result.stream.size)
  }
  return sendStream(event, result.stream.stream)
})
