import { getQuery, setHeader } from 'h3'
import { fail } from '#server/utils/http'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminCsvFormatQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = adminCsvFormatQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid analytics usage csv query parameters')
  }

  const result = await analyticsService.getUsage(parsed.data)
  const csv = analyticsService.buildUsageCsv(result)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'attachment; filename="admin-usage.csv"')
  return csv
})
