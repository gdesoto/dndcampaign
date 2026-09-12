import { setHeader } from 'h3'
import { validateQuery } from '#server/utils/validate'
import { requireSystemAdmin } from '#server/utils/campaign-auth'
import { adminAnalyticsJobsQuerySchema } from '#shared/schemas/admin'
import { AdminAnalyticsService } from '#server/services/admin-analytics.service'

const analyticsService = new AdminAnalyticsService()

export default defineEventHandler(async (event) => {
  const authz = await requireSystemAdmin(event)
  if (!authz.ok) {
    return authz.response
  }

  const parsed = validateQuery(event, adminAnalyticsJobsQuerySchema, 'Invalid analytics jobs csv query parameters')
  if (!parsed.ok) return parsed.response

  const result = await analyticsService.getJobs(parsed.data)
  const csv = analyticsService.buildJobsCsv(result)

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', 'attachment; filename="admin-jobs.csv"')
  return csv
})
