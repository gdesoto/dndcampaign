import { getQuery } from 'h3'
import { ok } from '#server/utils/http'
import { CampaignPublicAccessService } from '#server/services/campaign-public-access.service'

const publicAccessService = new CampaignPublicAccessService()

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limitRaw = Number.parseInt(String(query.limit || ''), 10)
  const randomRaw = String(query.random || '').toLowerCase()
  const search = typeof query.search === 'string' ? query.search : undefined

  const result = await publicAccessService.listPublicCampaignDirectory({
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    random: randomRaw === '1' || randomRaw === 'true',
    search,
  })

  return ok(result.data)
})
