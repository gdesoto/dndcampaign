import { createHash, randomUUID } from 'node:crypto'
import { prisma } from '#server/db/prisma'
import { DocumentService } from '#server/services/document.service'
import { isSegmentedTranscript, parseTranscriptSegments, segmentsToPlainText } from '#shared/utils/transcript'
import type { SummaryContent, SummarySuggestions } from '#shared/schemas/summarization'
import { n8nWebhookPayloadSchema } from '#shared/schemas/summarization'
import type { Document, DocumentFormat } from '@prisma/client'

export type StartSummarizationInput = {
  documentId: string
  userId: string
  webhookUrlOverride?: string
  promptProfile?: string
  mode: 'sync' | 'async'
}

export type SummaryJobResult = {
  trackingId: string
  summaryDocumentId?: string
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

export class SummaryService {
  private documentService = new DocumentService()

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
        campaign: { ownerId: input.userId },
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

    const glossaryEntries = await prisma.glossaryEntry.findMany({
      where: { campaignId: document.campaignId },
      select: { id: true, type: true, name: true, aliases: true, description: true },
    })
    const quests = await prisma.quest.findMany({
      where: { campaignId: document.campaignId },
      select: { id: true, title: true, status: true, description: true, progressNotes: true },
    })
    const milestones = await prisma.milestone.findMany({
      where: { campaignId: document.campaignId },
      select: { id: true, title: true, description: true, isComplete: true },
    })

    const groupedGlossary = {
      pcs: glossaryEntries.filter((entry) => entry.type === 'PC'),
      npcs: glossaryEntries.filter((entry) => entry.type === 'NPC'),
      items: glossaryEntries.filter((entry) => entry.type === 'ITEM'),
      locations: glossaryEntries.filter((entry) => entry.type === 'LOCATION'),
    }

    const job = await prisma.summaryJob.create({
      data: {
        campaignId: document.campaignId,
        sessionId: document.sessionId || document.session.id,
        documentId: document.id,
        trackingId,
        status: 'QUEUED',
        mode: input.mode === 'sync' ? 'SYNC' : 'ASYNC',
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

    const callbackUrl = config.public?.appUrl
      ? `${config.public.appUrl.replace(/\/$/, '')}/api/webhooks/n8n/summary`
      : undefined

    const payload = {
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
      },
      callback: callbackUrl
        ? {
            url: callbackUrl,
            secret: config.n8n?.webhookSecret || '',
          }
        : undefined,
    }

    try {
      const response = await $fetch(webhookUrl, {
        method: 'POST',
        body: payload,
      })

      if (input.mode === 'sync') {
        const parsed = n8nWebhookPayloadSchema.safeParse(response)
        if (parsed.success && parsed.data.summaryContent) {
          const handled = await this.handleSummaryResult({
            trackingId,
            status: parsed.data.status,
            summaryContent: parsed.data.summaryContent,
            suggestions: parsed.data.suggestions,
            meta: parsed.data.meta,
          })
          return { trackingId, summaryDocumentId: handled?.summaryDocumentId || undefined }
        }
      }

      await prisma.summaryJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
        },
      })

      console.info('[summary] sent', { trackingId, jobId: job.id })

      return { trackingId }
    } catch (error) {
      await prisma.summaryJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error & { message?: string }).message || 'Summarization failed',
        },
      })
      console.info('[summary] failed', {
        trackingId,
        jobId: job.id,
        message: (error as Error & { message?: string }).message || 'Summarization failed',
      })
      throw error
    }
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
          meta: payload.meta || job.meta || undefined,
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
          meta: payload.meta || job.meta || undefined,
        },
      })
    }

    const suggestionInputs = flattenSuggestions(payload.suggestions)
    await prisma.$transaction(async (tx) => {
      await tx.summarySuggestion.deleteMany({ where: { summaryJobId: job.id } })
      if (suggestionInputs.length) {
        await tx.summarySuggestion.createMany({
          data: suggestionInputs.map((entry) => ({
            summaryJobId: job.id,
            entityType: entry.entityType,
            action: entry.action,
            status: 'PENDING',
            match: entry.match || undefined,
            payload: entry.payload,
          })),
        })
      }
    })

    const responseHash = createHash('sha256')
      .update(JSON.stringify({ summaryContent: payload.summaryContent, suggestions: payload.suggestions }))
      .digest('hex')

    const nextMeta: Record<string, unknown> = {
      ...(payload.meta || {}),
      summaryContent: payload.summaryContent,
    }

    return prisma.summaryJob.update({
      where: { id: job.id },
      data: {
        status: 'READY_FOR_REVIEW',
        responseHash,
        meta: nextMeta,
      },
    })
  }

  async applySummaryFromJob(jobId: string, userId: string) {
    const job = await prisma.summaryJob.findFirst({
      where: { id: jobId, campaign: { ownerId: userId } },
      include: { session: true },
    })
    if (!job) return null

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

  async getLatestJobForSession(sessionId: string, userId: string) {
    return prisma.summaryJob.findFirst({
      where: {
        sessionId,
        campaign: { ownerId: userId },
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
        campaign: { ownerId: userId },
      },
      include: {
        summaryDocument: true,
        suggestions: true,
      },
    })
  }
}
