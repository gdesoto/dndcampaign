import type { JsonValue } from '#server/db/columns'
import { createHash, randomUUID } from 'node:crypto'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '#server/db/client'
import { glossaryEntry as glossaryEntryTable, quest as questTable, milestone as milestoneTable, document as documentTable, summaryJob as summaryJobTable, session as sessionTable, summarySuggestion as summarySuggestionTable } from '#server/db/schema'
import { DocumentService } from '#server/services/document.service'
import { isSegmentedTranscript, parseTranscriptSegments, segmentsToPlainText } from '#shared/utils/transcript'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'
import type {
  N8nRequestPayload,
  N8nSuggestionRequestPayload,
  SummaryContent,
  SummarySuggestions,
} from '#shared/schemas/summarization'
import { n8nWebhookPayloadSchema } from '#shared/schemas/summarization'
import type { Document, DocumentFormat} from '#server/db/schema'

export type StartSummarizationInput = {
  documentId: string
  userId: string
  webhookUrlOverride?: string
  promptProfile?: string
  mode: 'sync' | 'async'
}

export type StartSuggestionGenerationInput = {
  sessionId: string
  userId: string
  summaryJobId?: string
  summaryDocumentId?: string
  webhookUrlOverride?: string
  promptProfile?: string
  mode: 'sync' | 'async'
}

export type SummaryJobResult = {
  trackingId: string
  summaryDocumentId?: string
}

type SummarySource = {
  content: string
  hash: string
  source: 'SUMMARY_DOCUMENT' | 'SUMMARY_JOB_META'
  summaryDocumentId?: string
  summaryJobId?: string
}

type SummaryResultPayload = {
  trackingId: string
  status?: 'COMPLETED' | 'FAILED' | 'PROCESSING'
  summaryContent?: SummaryContent
  suggestions?: SummarySuggestions
  meta?: Record<string, unknown>
}

type NormalizedTranscript = {
  content: string
  format: DocumentFormat
  hash: string
}

type SuggestionInput = {
  entityType: 'SESSION' | 'QUEST' | 'MILESTONE' | 'GLOSSARY' | 'PC' | 'NPC' | 'ITEM' | 'LOCATION'
  action: 'CREATE' | 'UPDATE' | 'DISCARD'
  match?: Record<string, unknown>
  payload: Record<string, unknown>
}

const normalizeTranscript = (document: Document & { currentVersion?: { content: string; format: DocumentFormat } | null }): NormalizedTranscript => {
  const content = document.currentVersion?.content || ''
  const trimmed = content.trim()
  const plainText = isSegmentedTranscript(trimmed)
    ? segmentsToPlainText(parseTranscriptSegments(trimmed), { includeDisabled: false })
    : content
  const hash = createHash('sha256').update(plainText).digest('hex')
  return {
    content: plainText,
    format: document.currentVersion?.format || 'MARKDOWN',
    hash,
  }
}

const hashText = (content: string) => createHash('sha256').update(content).digest('hex')

const resolveSummaryText = (summaryContent?: SummaryContent) => {
  if (!summaryContent) return ''
  if (typeof summaryContent === 'string') return summaryContent
  return summaryContent.fullSummary || ''
}

const normalizeAction = (value?: string): 'CREATE' | 'UPDATE' | 'DISCARD' => {
  switch ((value || '').toLowerCase()) {
    case 'update':
      return 'UPDATE'
    case 'discard':
      return 'DISCARD'
    default:
      return 'CREATE'
  }
}

const stripSuggestionPayload = (item: Record<string, unknown>) => {
  const payload = { ...item }
  delete payload.action
  delete payload.match
  return payload
}

const flattenSuggestions = (suggestions?: SummarySuggestions): SuggestionInput[] => {
  if (!suggestions) return []
  const items: SuggestionInput[] = []
  const pushItems = (entityType: SuggestionInput['entityType'], entries?: Record<string, unknown>[]) => {
    if (!entries?.length) return
    for (const entry of entries) {
      items.push({
        entityType,
        action: normalizeAction(entry.action as string | undefined),
        match: (entry.match as Record<string, unknown> | undefined) || undefined,
        payload: stripSuggestionPayload(entry),
      })
    }
  }

  pushItems('QUEST', suggestions.quests as Record<string, unknown>[] | undefined)
  pushItems('MILESTONE', suggestions.milestones as Record<string, unknown>[] | undefined)

  if (suggestions.session && typeof suggestions.session === 'object') {
    items.push({
      entityType: 'SESSION',
      action: normalizeAction((suggestions.session as Record<string, unknown>).action as string | undefined),
      match: (suggestions.session as Record<string, unknown>).match as Record<string, unknown> | undefined,
      payload: stripSuggestionPayload(suggestions.session as Record<string, unknown>),
    })
  }

  if (suggestions.glossary && typeof suggestions.glossary === 'object') {
    const glossary = suggestions.glossary as Record<string, Record<string, unknown>[]>
    pushItems('PC', glossary.pcs)
    pushItems('NPC', glossary.npcs)
    pushItems('ITEM', glossary.items)
    pushItems('LOCATION', glossary.locations)
  }

  return items
}

const getCallback = (config: ReturnType<typeof useRuntimeConfig>) => {
  const callbackUrl = config.public?.appUrl
    ? `${config.public.appUrl.replace(/\/$/, '')}/api/webhooks/n8n/summary`
    : undefined

  if (!callbackUrl) return undefined
  return {
    url: callbackUrl,
    secret: config.n8n?.webhookSecret || '',
  }
}

const getMirroredSuggestionTrackingId = (summaryTrackingId: string) => `sugjob_${summaryTrackingId}`

export class SummaryService {
  private documentService = new DocumentService()

  private async loadCampaignContext(campaignId: string) {
    const glossaryEntries = (db.query.glossaryEntry.findMany({ where: eq(glossaryEntryTable.campaignId, campaignId), columns: { id: true, type: true, name: true, aliases: true, description: true } }).sync())
    const quests = (db.query.quest.findMany({ where: eq(questTable.campaignId, campaignId), columns: { id: true, title: true, status: true, description: true, progressNotes: true } }).sync())
    const milestones = (db.query.milestone.findMany({ where: eq(milestoneTable.campaignId, campaignId), columns: { id: true, title: true, description: true, isComplete: true } }).sync())

    return {
      groupedGlossary: {
        pcs: glossaryEntries.filter((entry) => entry.type === 'PC'),
        npcs: glossaryEntries.filter((entry) => entry.type === 'NPC'),
        items: glossaryEntries.filter((entry) => entry.type === 'ITEM'),
        locations: glossaryEntries.filter((entry) => entry.type === 'LOCATION'),
      },
      quests,
      milestones,
    }
  }

  private async resolveSummarySourceForSuggestions(input: StartSuggestionGenerationInput): Promise<SummarySource> {
    const summaryDocument = input.summaryDocumentId
      ? (db.query.document.findFirst({ where: and(eq(documentTable.id, input.summaryDocumentId), eq(documentTable.type, 'SUMMARY'), eq(documentTable.sessionId, input.sessionId), buildCampaignWhereForPermission(input.userId, 'summary.run', documentTable.campaignId)), with: { currentVersion: true } }).sync() ?? null)
      : null
    if (summaryDocument?.currentVersion?.content) {
      const content = summaryDocument.currentVersion.content.trim()
      return {
        content,
        hash: hashText(content),
        source: 'SUMMARY_DOCUMENT',
        summaryDocumentId: summaryDocument.id,
      }
    }

    const referencedJob = input.summaryJobId
      ? (db.query.summaryJob.findFirst({ where: and(eq(summaryJobTable.id, input.summaryJobId), eq(summaryJobTable.sessionId, input.sessionId), buildCampaignWhereForPermission(input.userId, 'summary.run', summaryJobTable.campaignId)), with: {
            summaryDocument: { with: { currentVersion: true } },
          } }).sync() ?? null)
      : null
    if (referencedJob?.summaryDocument?.currentVersion?.content) {
      const content = referencedJob.summaryDocument.currentVersion.content.trim()
      return {
        content,
        hash: hashText(content),
        source: 'SUMMARY_DOCUMENT',
        summaryDocumentId: referencedJob.summaryDocument.id,
        summaryJobId: referencedJob.id,
      }
    }

    const referencedJobSummary = resolveSummaryText(
      (referencedJob?.meta as { summaryContent?: SummaryContent } | null)?.summaryContent
    ).trim()
    if (referencedJob?.id && referencedJobSummary) {
      return {
        content: referencedJobSummary,
        hash: hashText(referencedJobSummary),
        source: 'SUMMARY_JOB_META',
        summaryJobId: referencedJob.id,
        summaryDocumentId: referencedJob.summaryDocumentId || undefined,
      }
    }

    const latestSummaryDocument = (db.query.document.findFirst({ where: and(eq(documentTable.sessionId, input.sessionId), eq(documentTable.type, 'SUMMARY'), buildCampaignWhereForPermission(input.userId, 'summary.run', documentTable.campaignId)), with: { currentVersion: true }, orderBy: [desc(documentTable.updatedAt)] }).sync() ?? null)
    if (latestSummaryDocument?.currentVersion?.content) {
      const content = latestSummaryDocument.currentVersion.content.trim()
      return {
        content,
        hash: hashText(content),
        source: 'SUMMARY_DOCUMENT',
        summaryDocumentId: latestSummaryDocument.id,
      }
    }

    const latestSummaryJob = (db.query.summaryJob.findFirst({ where: and(eq(summaryJobTable.sessionId, input.sessionId), buildCampaignWhereForPermission(input.userId, 'summary.run', summaryJobTable.campaignId), eq(summaryJobTable.kind, 'SUMMARY_GENERATION')), orderBy: [desc(summaryJobTable.createdAt)] }).sync() ?? null)
    const latestSummaryJobText = resolveSummaryText(
      (latestSummaryJob?.meta as { summaryContent?: SummaryContent } | null)?.summaryContent
    ).trim()
    if (latestSummaryJob?.id && latestSummaryJobText) {
      return {
        content: latestSummaryJobText,
        hash: hashText(latestSummaryJobText),
        source: 'SUMMARY_JOB_META',
        summaryJobId: latestSummaryJob.id,
        summaryDocumentId: latestSummaryJob.summaryDocumentId || undefined,
      }
    }

    throw new Error('Summary content is required before generating suggestions')
  }

  private async dispatchToN8n(
    input: {
      jobId: string
      trackingId: string
      webhookUrl: string
      mode: 'sync' | 'async'
      payload: N8nRequestPayload | N8nSuggestionRequestPayload
      failureMessage: string
    }
  ): Promise<SummaryJobResult> {
    try {
      const response = await $fetch(input.webhookUrl, {
        method: 'POST',
        body: input.payload,
      })

      if (input.mode === 'sync') {
        const parsed = n8nWebhookPayloadSchema.safeParse(response)
        if (parsed.success) {
          const handled = await this.handleSummaryResult({
            trackingId: input.trackingId,
            status: parsed.data.status,
            summaryContent: parsed.data.summaryContent,
            suggestions: parsed.data.suggestions,
            meta: parsed.data.meta,
          })
          return { trackingId: input.trackingId, summaryDocumentId: handled?.summaryDocumentId || undefined }
        }
      }

      db.update(summaryJobTable).set({
          status: 'SENT',
        }).where(eq(summaryJobTable.id, input.jobId)).returning().get()!

      console.info('[summary] sent', { trackingId: input.trackingId, jobId: input.jobId })

      return { trackingId: input.trackingId }
    } catch (error) {
      db.update(summaryJobTable).set({
          status: 'FAILED',
          errorMessage: (error as Error & { message?: string }).message || input.failureMessage,
        }).where(eq(summaryJobTable.id, input.jobId)).returning().get()!
      console.info('[summary] failed', {
        trackingId: input.trackingId,
        jobId: input.jobId,
        message: (error as Error & { message?: string }).message || input.failureMessage,
      })
      throw error
    }
  }

  async startSummarization(input: StartSummarizationInput): Promise<SummaryJobResult> {
    const config = useRuntimeConfig()
    const webhookUrl = input.webhookUrlOverride || config.n8n?.webhookUrlDefault
    if (!webhookUrl) {
      throw new Error('n8n webhook URL is not configured')
    }

    const document = (db.query.document.findFirst({ where: and(eq(documentTable.id, input.documentId), eq(documentTable.type, 'TRANSCRIPT'), buildCampaignWhereForPermission(input.userId, 'summary.run', documentTable.campaignId)), with: {
        currentVersion: true,
        session: true,
        campaign: true,
      } }).sync() ?? null)

    if (!document || !document.session) {
      throw new Error('Transcript document not found')
    }

    if (!document.currentVersion?.content) {
      throw new Error('Transcript document has no content')
    }

    const transcript = normalizeTranscript(document)
    const trackingId = `sumjob_${randomUUID()}`

    const { groupedGlossary, quests, milestones } = await this.loadCampaignContext(document.campaignId)

    const job = (db.insert(summaryJobTable).values({
        campaignId: document.campaignId,
        sessionId: document.sessionId || document.session.id,
        documentId: document.id,
        trackingId,
        status: 'QUEUED',
        mode: input.mode === 'sync' ? 'SYNC' : 'ASYNC',
        kind: 'SUMMARY_GENERATION',
        promptProfile: input.promptProfile || null,
        webhookUrl,
        requestHash: transcript.hash,
      }).returning().get()!)

    console.info('[summary] start', {
      trackingId,
      campaignId: document.campaignId,
      sessionId: document.sessionId || document.session.id,
      documentId: document.id,
      mode: input.mode,
      requestHash: transcript.hash,
    })

    const payload: N8nRequestPayload = {
      trackingId,
      campaignId: document.campaignId,
      sessionId: document.sessionId || document.session.id,
      documentId: document.id,
      transcript: {
        format: transcript.format,
        readOnly: true,
        content: transcript.content,
        hash: `sha256:${transcript.hash}`,
      },
      promptProfile: input.promptProfile,
      context: {
        campaignName: document.campaign.name,
        sessionTitle: document.session.title,
        sessionNumber: document.session.sessionNumber,
        playedAt: document.session.playedAt?.toISOString() || null,
        existingGlossary: groupedGlossary,
        quests,
        milestones,
      },
      options: {
        mode: input.mode,
        jobKind: 'SUMMARY_GENERATION',
      },
      callback: getCallback(config),
    }

    return this.dispatchToN8n({
      jobId: job.id,
      trackingId,
      webhookUrl,
      mode: input.mode,
      payload,
      failureMessage: 'Summarization failed',
    })
  }

  async startSuggestionGeneration(input: StartSuggestionGenerationInput): Promise<SummaryJobResult> {
    const config = useRuntimeConfig()
    const webhookUrl = input.webhookUrlOverride || config.n8n?.webhookUrlDefault
    if (!webhookUrl) {
      throw new Error('n8n webhook URL is not configured')
    }

    const session = (db.query.session.findFirst({ where: and(eq(sessionTable.id, input.sessionId), buildCampaignWhereForPermission(input.userId, 'summary.run', sessionTable.campaignId)), with: {
        campaign: true,
      } }).sync() ?? null)
    if (!session) {
      throw new Error('Session not found')
    }

    const summarySource = await this.resolveSummarySourceForSuggestions(input)
    const trackingId = `sumjob_${randomUUID()}`
    const { groupedGlossary, quests, milestones } = await this.loadCampaignContext(session.campaignId)

    const baseDocument =
      ((db.query.document.findFirst({ where: and(eq(documentTable.sessionId, session.id), eq(documentTable.type, 'TRANSCRIPT')), columns: { id: true } }).sync() ?? null)) ||
      (summarySource.summaryDocumentId
        ? (db.query.document.findFirst({ where: and(eq(documentTable.id, summarySource.summaryDocumentId), eq(documentTable.sessionId, session.id), eq(documentTable.type, 'SUMMARY')), columns: { id: true } }).sync() ?? null)
        : null)
    if (!baseDocument) {
      throw new Error('Unable to resolve a document for this suggestion job')
    }

    const job = (db.insert(summaryJobTable).values({
        campaignId: session.campaignId,
        sessionId: session.id,
        documentId: baseDocument.id,
        summaryDocumentId: summarySource.summaryDocumentId || null,
        trackingId,
        status: 'QUEUED',
        mode: input.mode === 'sync' ? 'SYNC' : 'ASYNC',
        kind: 'SUGGESTION_GENERATION',
        promptProfile: input.promptProfile || null,
        webhookUrl,
        requestHash: summarySource.hash,
      }).returning().get()!)

    console.info('[summary] suggestion-start', {
      trackingId,
      campaignId: session.campaignId,
      sessionId: session.id,
      documentId: baseDocument.id,
      mode: input.mode,
      requestHash: summarySource.hash,
      summarySource: summarySource.source,
    })

    const payload: N8nSuggestionRequestPayload = {
      trackingId,
      campaignId: session.campaignId,
      sessionId: session.id,
      summary: {
        content: summarySource.content,
        hash: `sha256:${summarySource.hash}`,
        source: summarySource.source,
        summaryDocumentId: summarySource.summaryDocumentId,
        summaryJobId: summarySource.summaryJobId,
      },
      promptProfile: input.promptProfile,
      context: {
        campaignName: session.campaign.name,
        sessionTitle: session.title,
        sessionNumber: session.sessionNumber,
        playedAt: session.playedAt?.toISOString() || null,
        existingGlossary: groupedGlossary,
        quests,
        milestones,
      },
      options: {
        mode: input.mode,
        jobKind: 'SUGGESTION_GENERATION',
      },
      callback: getCallback(config),
    }

    return this.dispatchToN8n({
      jobId: job.id,
      trackingId,
      webhookUrl,
      mode: input.mode,
      payload,
      failureMessage: 'Suggestion generation failed',
    })
  }

  async handleSummaryResult(payload: SummaryResultPayload) {
    const job = (db.query.summaryJob.findFirst({ where: eq(summaryJobTable.trackingId, payload.trackingId), with: {
        session: true,
        campaign: true,
        summaryDocument: true,
      } }).sync() ?? null)

    if (!job || !job.session) {
      return null
    }

    const forceOverwrite =
      Boolean(payload.meta && typeof payload.meta === 'object' && (payload.meta as { forceOverwrite?: boolean }).forceOverwrite)

    if (!forceOverwrite && (job.status === 'READY_FOR_REVIEW' || job.status === 'APPLIED')) {
      return job
    }

    if (payload.status === 'FAILED') {
      const failed = (db.update(summaryJobTable).set({
          status: 'FAILED',
          errorMessage: job.errorMessage || 'Summarization failed',
          meta: payload.meta ? JSON.parse(JSON.stringify(payload.meta)) as JsonValue : job.meta || undefined,
        }).where(eq(summaryJobTable.id, job.id)).returning().get()!)
      console.info('[summary] webhook failed', { trackingId: payload.trackingId, jobId: job.id })
      return failed
    }

    if (payload.status === 'PROCESSING' && !payload.summaryContent) {
      return (db.update(summaryJobTable).set({
          status: 'PROCESSING',
          meta: payload.meta ? JSON.parse(JSON.stringify(payload.meta)) as JsonValue : job.meta || undefined,
        }).where(eq(summaryJobTable.id, job.id)).returning().get()!)
    }

    const suggestionInputs = flattenSuggestions(payload.suggestions)
    const shouldMirrorIntoSuggestionJob =
      job.kind === 'SUMMARY_GENERATION' && suggestionInputs.length > 0
    const mirroredTrackingId = getMirroredSuggestionTrackingId(job.trackingId)

    db.transaction((tx) => {
      tx.delete(summarySuggestionTable).where(eq(summarySuggestionTable.summaryJobId, job.id)).run()
      if (suggestionInputs.length) {
        tx.insert(summarySuggestionTable).values(suggestionInputs.map((entry) => ({
            summaryJobId: job.id,
            entityType: entry.entityType,
            action: entry.action,
            status: 'PENDING' as const,
            match: entry.match ? JSON.parse(JSON.stringify(entry.match)) as JsonValue : undefined,
            payload: JSON.parse(JSON.stringify(entry.payload)) as JsonValue,
          }))).run()
      }

      if (shouldMirrorIntoSuggestionJob) {
        const mirroredJob = (tx.insert(summaryJobTable).values({
            campaignId: job.campaignId,
            sessionId: job.sessionId,
            documentId: job.documentId,
            summaryDocumentId: job.summaryDocumentId,
            trackingId: mirroredTrackingId,
            status: 'READY_FOR_REVIEW',
            mode: job.mode,
            kind: 'SUGGESTION_GENERATION',
            promptProfile: job.promptProfile,
            webhookUrl: job.webhookUrl,
            requestHash: job.requestHash,
            responseHash: createHash('sha256')
              .update(JSON.stringify({ sourceTrackingId: job.trackingId, suggestions: payload.suggestions }))
              .digest('hex'),
            meta: {
              source: 'SUMMARY_GENERATION_CALLBACK',
              sourceSummaryJobId: job.id,
              sourceTrackingId: job.trackingId,
            },
          }).onConflictDoUpdate({ target: summaryJobTable.trackingId, set: {
            status: 'READY_FOR_REVIEW',
            summaryDocumentId: job.summaryDocumentId,
            promptProfile: job.promptProfile,
            webhookUrl: job.webhookUrl,
            requestHash: job.requestHash,
            responseHash: createHash('sha256')
              .update(JSON.stringify({ sourceTrackingId: job.trackingId, suggestions: payload.suggestions }))
              .digest('hex'),
            meta: {
              source: 'SUMMARY_GENERATION_CALLBACK',
              sourceSummaryJobId: job.id,
              sourceTrackingId: job.trackingId,
            },
            errorMessage: null,
          } }).returning().get()!)

        tx.delete(summarySuggestionTable).where(eq(summarySuggestionTable.summaryJobId, mirroredJob.id)).run()
        tx.insert(summarySuggestionTable).values(suggestionInputs.map((entry) => ({
            summaryJobId: mirroredJob.id,
            entityType: entry.entityType,
            action: entry.action,
            status: 'PENDING' as const,
            match: entry.match ? JSON.parse(JSON.stringify(entry.match)) as JsonValue : undefined,
            payload: JSON.parse(JSON.stringify(entry.payload)) as JsonValue,
          }))).run()
      }
    }, { behavior: 'immediate' })

    const responseHash = createHash('sha256')
      .update(JSON.stringify({ summaryContent: payload.summaryContent, suggestions: payload.suggestions }))
      .digest('hex')

    const previousMeta = (job.meta && typeof job.meta === 'object' ? job.meta : {}) as Record<string, unknown>
    const nextMeta: Record<string, unknown> = {
      ...previousMeta,
      ...(payload.meta || {}),
    }
    if (payload.summaryContent) {
      nextMeta.summaryContent = payload.summaryContent
    }

    return (db.update(summaryJobTable).set({
        status: 'READY_FOR_REVIEW',
        responseHash,
        meta: JSON.parse(JSON.stringify(nextMeta)) as JsonValue,
      }).where(eq(summaryJobTable.id, job.id)).returning().get()!)
  }

  async applySummaryFromJob(jobId: string, userId: string) {
    const job = (db.query.summaryJob.findFirst({ where: and(eq(summaryJobTable.id, jobId), buildCampaignWhereForPermission(userId, 'summary.run', summaryJobTable.campaignId)), with: { session: true } }).sync() ?? null)
    if (!job) return null
    if (job.kind !== 'SUMMARY_GENERATION') {
      throw new Error('Only summary-generation jobs can apply summary content')
    }

    const summaryText = resolveSummaryText(
      (job.meta as { summaryContent?: SummaryContent } | null)?.summaryContent
    )
    if (!summaryText) {
      throw new Error('Summary content is missing')
    }

    let summaryDocumentId = job.summaryDocumentId
    if (!summaryDocumentId) {
      const titleBase = 'Summary'
      const title = job.session?.title ? `${titleBase}: ${job.session.title}` : titleBase
      const document = await this.documentService.upsertForSession(job.sessionId, 'SUMMARY', {
        campaignId: job.campaignId,
        title,
        content: summaryText,
        format: 'MARKDOWN',
        source: 'N8N_IMPORT',
        createdByUserId: null,
      })
      summaryDocumentId = document.id
    } else {
      await this.documentService.updateDocument({
        documentId: summaryDocumentId,
        content: summaryText,
        format: 'MARKDOWN',
        source: 'N8N_IMPORT',
        createdByUserId: null,
      })
    }

    const pendingCount = (db.select({ count: count() }).from(summarySuggestionTable).where(and(eq(summarySuggestionTable.summaryJobId, job.id), eq(summarySuggestionTable.status, 'PENDING'))).get()!.count)

    return (db.update(summaryJobTable).set({
        summaryDocumentId,
        status: pendingCount === 0 ? 'APPLIED' : job.status,
      }).where(eq(summaryJobTable.id, job.id)).returning().get()!)
  }

  async getJobsForSession(sessionId: string, userId: string) {
    const where = and(eq(summaryJobTable.sessionId, sessionId), buildCampaignWhereForPermission(userId, 'content.read', summaryJobTable.campaignId))
    const jobs = (db.query.summaryJob.findMany({ where: where, orderBy: [desc(summaryJobTable.createdAt), desc(summaryJobTable.id)], columns: { id: true, status: true, mode: true, kind: true, trackingId: true, summaryDocumentId: true, createdAt: true, updatedAt: true } }).sync())
    const summaryId = jobs.find(job => job.kind === 'SUMMARY_GENERATION')?.id
    const suggestionId = jobs.find(job => job.kind === 'SUGGESTION_GENERATION')?.id
    const latestIds = [summaryId, suggestionId].filter((id): id is string => Boolean(id))
    const latestJobs = latestIds.length ? (db.query.summaryJob.findMany({ where: and(where, inArray(summaryJobTable.id, latestIds)), columns: { id: true, status: true, mode: true, kind: true, trackingId: true, promptProfile: true, summaryDocumentId: true, createdAt: true, updatedAt: true, meta: true }, with: { suggestions: { columns: { id: true, entityType: true, action: true, status: true, match: true, payload: true } } } }).sync()) : []
    const latestSummary = latestJobs.find(job => job.id === summaryId)
    const latestSuggestion = latestJobs.find(job => job.id === suggestionId)
    const latest = latestJobs.find(job => job.id === jobs[0]?.id)
    const jobWithoutSuggestions = (job: typeof latest) => {
      if (!job) return null
      const { suggestions: _suggestions, ...data } = job
      return data
    }
    return {
      job: jobWithoutSuggestions(latest),
      latestSummaryJob: jobWithoutSuggestions(latestSummary),
      latestSuggestionJob: jobWithoutSuggestions(latestSuggestion),
      suggestions: latest?.suggestions || [],
      latestSummarySuggestions: latestSummary?.suggestions || [],
      latestSuggestionSuggestions: latestSuggestion?.suggestions || [],
      jobs,
    }
  }

  async getJobById(jobId: string, userId: string) {
    return (db.query.summaryJob.findFirst({ where: and(eq(summaryJobTable.id, jobId), buildCampaignWhereForPermission(userId, 'content.read', summaryJobTable.campaignId)), with: {
        summaryDocument: true,
        suggestions: true,
      } }).sync() ?? null)
  }
}

