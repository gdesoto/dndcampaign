import { getRequestHeader, sendStream, setHeader, setResponseHeaders, setResponseStatus } from 'h3'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'
import { routeParams } from '#server/utils/http'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const { publicSlug, recapId } = routeParams(event, 'publicSlug', 'recapId')

  const result = await publicAccessService.getPublicRecapStream(publicSlug, recapId, getRequestHeader(event, 'range'))

  setHeader(event, 'Content-Type', result.contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${result.filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  setResponseHeaders(event, { 'Content-Security-Policy': 'sandbox', 'X-Content-Type-Options': 'nosniff' })
  setResponseStatus(event, result.stream.statusCode)
  for (const [name, value] of Object.entries(result.stream.headers)) {
    setHeader(event, name, value)
  }

  return result.stream.body ? sendStream(event, result.stream.body) : ''
})
