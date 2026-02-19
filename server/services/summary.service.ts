import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '#server/db/prisma'
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
import type { Document, DocumentFormat, Prisma } from '@prisma/client'

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
    const glossaryEntries = await prisma.glossaryEntry.findMany({
      where: { campaignId },
      select: { id: true, type: true, name: true, aliases: true, description: true },
    })
    const quests = await prisma.quest.findMany({
      where: { campaignId },
      select: { id: true, title: true, status: true, description: true, progressNotes: true },
    })
    const milestones = await prisma.milestone.findMany({
      where: { campaignId },
      select: { id: true, title: true, description: true, isComplete: true },
    })

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
      ? await prisma.document.findFirst({
          where: {
            id: input.summaryDocumentId,
            type: 'SUMMARY',
            sessionId: input.sessionId,
            campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
          },
          include: { currentVersion: true },
        })
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
      ? await prisma.summaryJob.findFirst({
          where: {
            id: input.summaryJobId,
            sessionId: input.sessionId,
            campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
          },
          include: {
            summaryDocument: { include: { currentVersion: true } },
          },
        })
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

    const latestSummaryDocument = await prisma.document.findFirst({
      where: {
        sessionId: input.sessionId,
        type: 'SUMMARY',
        campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
      },
      include: { currentVersion: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (latestSummaryDocument?.currentVersion?.content) {
      const content = latestSummaryDocument.currentVersion.content.trim()
      return {
        content,
        hash: hashText(content),
        source: 'SUMMARY_DOCUMENT',
        summaryDocumentId: latestSummaryDocument.id,
      }
    }

    const latestSummaryJob = await prisma.summaryJob.findFirst({
      where: {
        sessionId: input.sessionId,
        campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
        kind: 'SUMMARY_GENERATION',
      },
      orderBy: { createdAt: 'desc' },
    })
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

      await prisma.summaryJob.update({
        where: { id: input.jobId },
        data: {
          status: 'SENT',
        },
      })

      console.info('[summary] sent', { trackingId: input.trackingId, jobId: input.jobId })

      return { trackingId: input.trackingId }
    } catch (error) {
      await prisma.summaryJob.update({
        where: { id: input.jobId },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error & { message?: string }).message || input.failureMessage,
        },
      })
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

    const document = await prisma.document.findFirst({
      where: {
        id: input.documentId,
        type: 'TRANSCRIPT',
        campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
      },
      include: {
        currentVersion: true,
        session: true,
        campaign: true,
      },
    })

    if (!document || !document.session) {
      throw new Error('Transcript document not found')
    }

    if (!document.currentVersion?.content) {
      throw new Error('Transcript document has no content')
    }

    const transcript = normalizeTranscript(document)
    const trackingId = `sumjob_${randomUUID()}`

    const { groupedGlossary, quests, milestones } = await this.loadCampaignContext(document.campaignId)

    const job = await prisma.summaryJob.create({
      data: {
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
      },
    })

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

    const session = await prisma.session.findFirst({
      where: {
        id: input.sessionId,
        campaign: buildCampaignWhereForPermission(input.userId, 'summary.run'),
      },
      include: {
        campaign: true,
      },
    })
    if (!session) {
      throw new Error('Session not found')
    }

    const summarySource = await this.resolveSummarySourceForSuggestions(input)
    const trackingId = `sumjob_${randomUUID()}`
    const { groupedGlossary, quests, milestones } = await this.loadCampaignContext(session.campaignId)

    const baseDocument =
      (await prisma.document.findFirst({
        where: { sessionId: session.id, type: 'TRANSCRIPT' },
        select: { id: true },
      })) ||
      (summarySource.summaryDocumentId
        ? await prisma.document.findFirst({
            where: { id: summarySource.summaryDocumentId, sessionId: session.id, type: 'SUMMARY' },
            select: { id: true },
          })
        : null)
    if (!baseDocument) {
      throw new Error('Unable to resolve a document for this suggestion job')
    }

    const job = await prisma.summaryJob.create({
      data: {
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
      },
    })

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
    const job = await prisma.summaryJob.findFirst({
      where: { trackingId: payload.trackingId },
      include: {
        session: true,
        campaign: true,
        summaryDocument: true,
      },
    })

    if (!job || !job.session) {
      return null
    }

    const forceOverwrite =
      Boolean(payload.meta && typeof payload.meta === 'object' && (payload.meta as { forceOverwrite?: boolean }).forceOverwrite)

    if (!forceOverwrite && (job.status === 'READY_FOR_REVIEW' || job.status === 'APPLIED')) {
      return job
    }

    if (payload.status === 'FAILED') {
      const failed = await prisma.summaryJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: job.errorMessage || 'Summarization failed',
          meta: (payload.meta || job.meta || undefined) as Prisma.InputJsonValue | undefined,
        },
      })
      console.info('[summary] webhook failed', { trackingId: payload.trackingId, jobId: job.id })
      return failed
    }

    if (payload.status === 'PROCESSING' && !payload.summaryContent) {
      return prisma.summaryJob.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSING',
          meta: (payload.meta || job.meta || undefined) as Prisma.InputJsonValue | undefined,
        },
      })
    }

    const suggestionInputs = flattenSuggestions(payload.suggestions)
    const shouldMirrorIntoSuggestionJob =
      job.kind === 'SUMMARY_GENERATION' && suggestionInputs.length > 0
    const mirroredTrackingId = getMirroredSuggestionTrackingId(job.trackingId)

    await prisma.$transaction(async (tx) => {
      await tx.summarySuggestion.deleteMany({ where: { summaryJobId: job.id } })
      if (suggestionInputs.length) {
        await tx.summarySuggestion.createMany({
          data: suggestionInputs.map((entry) => ({
            summaryJobId: job.id,
            entityType: entry.entityType,
            action: entry.action,
            status: 'PENDING',
            match: (entry.match || undefined) as Prisma.InputJsonValue | undefined,
            payload: entry.payload as Prisma.InputJsonValue,
          })),
        })
      }

      if (shouldMirrorIntoSuggestionJob) {
        const mirroredJob = await tx.summaryJob.upsert({
          where: { trackingId: mirroredTrackingId },
          create: {
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
            } as Prisma.InputJsonValue,
          },
          update: {
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
            } as Prisma.InputJsonValue,
            errorMessage: null,
          },
        })

        await tx.summarySuggestion.deleteMany({ where: { summaryJobId: mirroredJob.id } })
        await tx.summarySuggestion.createMany({
          data: suggestionInputs.map((entry) => ({
            summaryJobId: mirroredJob.id,
            entityType: entry.entityType,
            action: entry.action,
            status: 'PENDING',
            match: (entry.match || undefined) as Prisma.InputJsonValue | undefined,
            payload: entry.payload as Prisma.InputJsonValue,
          })),
        })
      }
    })

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

    return prisma.summaryJob.update({
      where: { id: job.id },
      data: {
        status: 'READY_FOR_REVIEW',
        responseHash,
        meta: nextMeta as Prisma.InputJsonValue,
      },
    })
  }

  async applySummaryFromJob(jobId: string, userId: string) {
    const job = await prisma.summaryJob.findFirst({
      where: { id: jobId, campaign: buildCampaignWhereForPermission(userId, 'summary.run') },
      include: { session: true },
    })
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
      const existingSummary = await prisma.document.findFirst({
        where: { sessionId: job.sessionId, type: 'SUMMARY' },
      })
      if (existingSummary) {
        summaryDocumentId = existingSummary.id
      } else {
        const titleBase = 'Summary'
        const title = job.session?.title ? `${titleBase}: ${job.session.title}` : titleBase
        const created = await this.documentService.createDocument({
          campaignId: job.campaignId,
          sessionId: job.sessionId,
          type: 'SUMMARY',
          title,
          content: summaryText,
          format: 'MARKDOWN',
          source: 'N8N_IMPORT',
          createdByUserId: null,
        })
        summaryDocumentId = created.id
      }
    }

    await this.documentService.updateDocument({
      documentId: summaryDocumentId,
      content: summaryText,
      format: 'MARKDOWN',
      source: 'N8N_IMPORT',
      createdByUserId: null,
    })

    const pendingCount = await prisma.summarySuggestion.count({
      where: { summaryJobId: job.id, status: 'PENDING' },
    })

    return prisma.summaryJob.update({
      where: { id: job.id },
      data: {
        summaryDocumentId,
        status: pendingCount === 0 ? 'APPLIED' : job.status,
      },
    })
  }

  async getLatestJobForSession(
    sessionId: string,
    userId: string,
    kind?: 'SUMMARY_GENERATION' | 'SUGGESTION_GENERATION'
  ) {
    return prisma.summaryJob.findFirst({
      where: {
        sessionId,
        campaign: buildCampaignWhereForPermission(userId, 'content.read'),
        kind: kind || undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        summaryDocument: true,
        suggestions: true,
      },
    })
  }

  async getJobById(jobId: string, userId: string) {
    return prisma.summaryJob.findFirst({
      where: {
        id: jobId,
        campaign: buildCampaignWhereForPermission(userId, 'content.read'),
      },
      include: {
        summaryDocument: true,
        suggestions: true,
      },
    })
  }
}
