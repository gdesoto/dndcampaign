import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { SummaryService } from '#server/services/summary.service'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)
  const sessionId = event.context.params?.sessionId
  if (!sessionId) {
    return fail(400, 'VALIDATION_ERROR', 'Session id is required')
  }

  const service = new SummaryService()
  const [job, latestSummaryJob, latestSuggestionJob] = await Promise.all([
    service.getLatestJobForSession(sessionId, sessionUser.user.id),
    service.getLatestJobForSession(sessionId, sessionUser.user.id, 'SUMMARY_GENERATION'),
    service.getLatestJobForSession(sessionId, sessionUser.user.id, 'SUGGESTION_GENERATION'),
  ])

  const jobs = await prisma.summaryJob.findMany({
    where: { sessionId, campaign: { ownerId: sessionUser.user.id } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      mode: true,
      kind: true,
      trackingId: true,
      summaryDocumentId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const mapJob = (entry: typeof job) => {
    if (!entry) return null
    return {
      id: entry.id,
      status: entry.status,
      mode: entry.mode,
      kind: entry.kind,
      trackingId: entry.trackingId,
      promptProfile: entry.promptProfile,
      summaryDocumentId: entry.summaryDocumentId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      meta: entry.meta,
    }
  }

  if (!job) {
    return ok({
      job: null,
      latestSummaryJob: mapJob(latestSummaryJob),
      latestSuggestionJob: mapJob(latestSuggestionJob),
      suggestions: [],
      latestSummarySuggestions: latestSummaryJob?.suggestions.map((suggestion) => ({
        id: suggestion.id,
        entityType: suggestion.entityType,
        action: suggestion.action,
        status: suggestion.status,
        match: suggestion.match,
        payload: suggestion.payload,
      })) || [],
      latestSuggestionSuggestions: latestSuggestionJob?.suggestions.map((suggestion) => ({
        id: suggestion.id,
        entityType: suggestion.entityType,
        action: suggestion.action,
        status: suggestion.status,
        match: suggestion.match,
        payload: suggestion.payload,
      })) || [],
      jobs,
    })
  }

  return ok({
    job: mapJob(job),
    latestSummaryJob: mapJob(latestSummaryJob),
    latestSuggestionJob: mapJob(latestSuggestionJob),
    suggestions: job.suggestions.map((suggestion) => ({
      id: suggestion.id,
      entityType: suggestion.entityType,
      action: suggestion.action,
      status: suggestion.status,
      match: suggestion.match,
      payload: suggestion.payload,
    })),
    latestSummarySuggestions: latestSummaryJob?.suggestions.map((suggestion) => ({
      id: suggestion.id,
      entityType: suggestion.entityType,
      action: suggestion.action,
      status: suggestion.status,
      match: suggestion.match,
      payload: suggestion.payload,
    })) || [],
    latestSuggestionSuggestions: latestSuggestionJob?.suggestions.map((suggestion) => ({
      id: suggestion.id,
      entityType: suggestion.entityType,
      action: suggestion.action,
      status: suggestion.status,
      match: suggestion.match,
      payload: suggestion.payload,
    })) || [],
    jobs,
  })
})
