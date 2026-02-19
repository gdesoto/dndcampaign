import { sendStream, setHeader } from 'h3'
import { fail } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const publicSlug = event.context.params?.publicSlug
  const mapSlug = event.context.params?.mapSlug
  if (!publicSlug || !mapSlug) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Public slug and map slug are required')
  }

  const result = await publicAccessService.getPublicMapSvg(publicSlug, mapSlug)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message)
  }

  setHeader(event, 'Content-Type', result.data.contentType)
  setHeader(event, 'Content-Disposition', `inline; filename="${result.data.filename}"`)
  setHeader(event, 'Cache-Control', 'no-store')
  if (result.data.stream.size != null) {
    setHeader(event, 'Content-Length', `${result.data.stream.size}`)
  }
  return sendStream(event, result.data.stream.stream)
})
