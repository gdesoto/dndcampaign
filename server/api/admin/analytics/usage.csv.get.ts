import { setHeader } from 'h3'
import { validateQuery } from '#server/utils/validate'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminCsvFormatQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  await requireSystemAdmin(event)

  const parsed = validateQuery(event, adminCsvFormatQuerySchema, 'Invalid analytics usage csv query parameters')

  const result = await analyticsService.getUsage(parsed)
  const csv = analyticsService.buildUsageCsv(result)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'attachment; filename="admin-usage.csv"')
  return csv
})
