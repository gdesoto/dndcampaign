import { validateQuery } from '#server/utils/validate'
import { ok } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminAnalyticsOverviewQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  await requireSystemAdmin(event)

  const parsed = validateQuery(event, adminAnalyticsOverviewQuerySchema, 'Invalid analytics overview query parameters')

  const result = await analyticsService.getOverview(parsed)
  return ok(result)
})
