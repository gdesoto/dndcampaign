import { validateQuery } from '#server/utils/validate'
import { ok } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminAnalyticsUsageQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  await requireSystemAdmin(event)

  const parsed = validateQuery(event, adminAnalyticsUsageQuerySchema, 'Invalid analytics usage query parameters')

  const result = await analyticsService.getUsage(parsed)
  return ok(result)
})
