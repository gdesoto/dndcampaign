import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import type { Readable } from 'node:stream'
import { prisma } from '#server/db/prisma'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { ArtifactService } from '#server/services/artifact.service'
import type {
  TranscriptionArtifactFormat,
  TranscriptionJob,
  TranscriptionStatus,
} from '@prisma/client'

type StartTranscriptionInput = {
  recordingId: string
  sessionId: string
  campaignId: string
  storageKey: string
  modelId: string
  formats: string[]
  numSpeakers?: number
  keyterms?: string[]
  diarize: boolean
  languageCode?: string
}

type WebhookFormatPayload = {
  requestedFormat?: string
  fileExtension?: string
  contentType?: string
  isBase64Encoded?: boolean
  content?: string
}

type NormalizedWebhookPayload = {
  transcriptionId?: string
  requestId?: string
  transcriptionText?: string
  webhookMetadata?: Record<string, unknown>
  formats: WebhookFormatPayload[]
}

type TranscriptionResponsePayload = {
  transcriptionId?: string
  text?: string
  additionalFormats?: {
    requestedFormat: string
    fileExtension: string
    contentType: string
    isBase64Encoded: boolean
    content: string
  }[]
}

const requestFormatMap: Record<string, { format: string }> = {
  txt: { format: 'txt' },
  srt: { format: 'srt' },
  docx: { format: 'docx' },
  pdf: { format: 'pdf' },
  html: { format: 'html' },
  segmented_json: { format: 'segmented_json' },
}

const formatToEnum: Record<string, TranscriptionArtifactFormat> = {
  txt: 'TXT',
  srt: 'SRT',
  docx: 'DOCX',
  pdf: 'PDF',
  html: 'HTML',
  segmented_json: 'SEGMENTED_JSON',
}

const formatToMimeType: Record<string, string> = {
  txt: 'text/plain',
  srt: 'text/srt',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
  html: 'text/html',
  segmented_json: 'application/json',
}

const streamToBuffer = async (stream: Readable) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const parseWebhookMetadata = (metadata: unknown): Record<string, unknown> | undefined => {
  if (!metadata) return undefined
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as Record<string, unknown>
      return parsed
    } catch {
      return { raw: metadata }
    }
  }
  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>
  }
  return undefined
}

const normalizeWebhookPayload = (payload: unknown): NormalizedWebhookPayload => {
  const root = (payload as { body?: unknown })?.body ?? payload
  const data = (root as { data?: unknown })?.data ?? root
  const transcription =
    (data as { transcription?: unknown })?.transcription ?? (root as { transcription?: unknown })?.transcription

  const transcriptionId =
    (transcription as { transcription_id?: string })?.transcription_id ??
    (data as { transcription_id?: string })?.transcription_id ??
    (root as { transcription_id?: string })?.transcription_id

  const requestId =
    (data as { request_id?: string })?.request_id ??
    (data as { requestId?: string })?.requestId ??
    (root as { request_id?: string })?.request_id

  const transcriptionText =
    (transcription as { text?: string })?.text ??
    (data as { text?: string })?.text

  const formats =
    (transcription as { additional_formats?: unknown[] })?.additional_formats ??
    (transcription as { additionalFormats?: unknown[] })?.additionalFormats ??
    []

  const webhookMetadata =
    parseWebhookMetadata(
      (data as { webhook_metadata?: unknown })?.webhook_metadata ??
        (data as { webhookMetadata?: unknown })?.webhookMetadata ??
        (root as { webhook_metadata?: unknown })?.webhook_metadata
    ) ?? undefined

  return {
    transcriptionId,
    requestId,
    transcriptionText,
    webhookMetadata,
    formats: Array.isArray(formats)
      ? formats.map((item) => ({
          requestedFormat:
            (item as { requested_format?: string })?.requested_format ??
            (item as { requestedFormat?: string })?.requestedFormat,
          fileExtension:
            (item as { file_extension?: string })?.file_extension ??
            (item as { fileExtension?: string })?.fileExtension,
          contentType:
            (item as { content_type?: string })?.content_type ??
            (item as { contentType?: string })?.contentType,
          isBase64Encoded:
            (item as { is_base64_encoded?: boolean })?.is_base64_encoded ??
            (item as { isBase64Encoded?: boolean })?.isBase64Encoded,
          content: (item as { content?: string })?.content,
        }))
      : [],
  }
}

export class TranscriptionService {
  private client: ElevenLabsClient
  private artifactService = new ArtifactService()

  constructor(
    private apiKey: string,
    private webhookId?: string,
    private webhookEnabled = true
  ) {
    this.client = new ElevenLabsClient({ apiKey: this.apiKey })
  }

  async startTranscription(input: StartTranscriptionInput) {
    const additionalFormats = input.formats
      .map((format) => requestFormatMap[format])
      .filter(Boolean)

    const job = await prisma.transcriptionJob.create({
      data: {
        recordingId: input.recordingId,
        provider: 'ELEVENLABS',
        status: 'SENDING',
        modelId: input.modelId,
        languageCode: input.languageCode,
        numSpeakers: input.numSpeakers,
        diarize: input.diarize,
        requestedFormats: JSON.stringify(input.formats),
        keyterms: input.keyterms ? JSON.stringify(input.keyterms) : undefined,
      },
    })

    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(input.storageKey)

    try {
      const response = (await this.client.speechToText.convert({
        modelId: input.modelId,
        file: stream,
        languageCode: input.languageCode,
        numSpeakers: input.numSpeakers,
        diarize: input.diarize,
        keyterms: input.keyterms,
        additionalFormats,
        webhook: this.webhookEnabled,
        webhookId: this.webhookEnabled ? this.webhookId || undefined : undefined,
        webhookMetadata: {
          transcriptionJobId: job.id,
          recordingId: input.recordingId,
          sessionId: input.sessionId,
          campaignId: input.campaignId,
        },
      })) as TranscriptionResponsePayload

      if (!this.webhookEnabled) {
        await this.storeArtifacts(job.id, normalizeResponsePayload(response))
        const updated = await prisma.transcriptionJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            externalJobId: response.transcriptionId,
            completedAt: new Date(),
          },
        })
        return updated
      }

      const updated = await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'SENT',
          requestId: (response as { requestId?: string }).requestId,
          externalJobId: (response as { transcriptionId?: string }).transcriptionId,
        },
      })

      return updated
    } catch (error) {
      await prisma.transcriptionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error & { message?: string }).message || 'Transcription failed',
        },
      })
      throw error
    }
  }

  async ingestWebhook(payload: unknown) {
    const normalized = normalizeWebhookPayload(payload)

    const metadata = normalized.webhookMetadata
    const jobId = metadata?.transcriptionJobId

    let job: (TranscriptionJob & {
      recording: { id: string; sessionId: string; session: { campaignId: string; campaign: { ownerId: string } } }
      artifacts: { format: TranscriptionArtifactFormat }[]
    }) | null = null

    if (normalized.transcriptionId) {
      job = await prisma.transcriptionJob.findFirst({
        where: { externalJobId: normalized.transcriptionId },
        include: {
          recording: { include: { session: { include: { campaign: true } } } },
          artifacts: true,
        },
      })
    }

    if (!job && jobId && typeof jobId === 'string') {
      job = await prisma.transcriptionJob.findFirst({
        where: { id: jobId },
        include: {
          recording: { include: { session: { include: { campaign: true } } } },
          artifacts: true,
        },
      })
    }

    if (!job && normalized.requestId) {
      job = await prisma.transcriptionJob.findFirst({
        where: { requestId: normalized.requestId },
        include: {
          recording: { include: { session: { include: { campaign: true } } } },
          artifacts: true,
        },
      })
    }

    if (!job) {
      return null
    }

    if (job.status === 'COMPLETED') {
      return job
    }

    await this.storeArtifacts(job.id, normalized)

    const status: TranscriptionStatus = 'COMPLETED'
    const updated = await prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status,
        externalJobId: normalized.transcriptionId || job.externalJobId,
        requestId: normalized.requestId || job.requestId,
        completedAt: new Date(),
      },
      include: {
        recording: { include: { session: { include: { campaign: true } } } },
        artifacts: true,
      },
    })

    return updated
  }

  async loadArtifactContent(artifactId: string) {
    const artifact = await prisma.artifact.findUnique({ where: { id: artifactId } })
    if (!artifact) return null
    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(artifact.storageKey)
    const buffer = await streamToBuffer(stream)
    return { artifact, buffer }
  }

  async fetchTranscription(jobId: string) {
    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
    })
    if (!job?.externalJobId) return null

    const response = (await this.client.speechToText.transcripts.get(
      job.externalJobId
    )) as TranscriptionResponsePayload

    await this.storeArtifacts(job.id, normalizeResponsePayload(response))

    return prisma.transcriptionJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })
  }

  async fetchTranscriptionByExternalId(jobId: string, externalJobId: string) {
    const response = (await this.client.speechToText.transcripts.get(
      externalJobId
    )) as TranscriptionResponsePayload

    await this.storeArtifacts(jobId, normalizeResponsePayload(response))

    return prisma.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })
  }

  private async storeArtifacts(jobId: string, normalized: NormalizedWebhookPayload) {
    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      include: {
        recording: { include: { session: { include: { campaign: true } } } },
        artifacts: true,
      },
    })
    if (!job) return null

    const ownerId = job.recording.session.campaign.ownerId
    const campaignId = job.recording.session.campaignId

    const existingFormats = new Set(job.artifacts.map((artifact) => artifact.format))
    for (const format of normalized.formats) {
      const requestedFormat = format.requestedFormat?.toLowerCase()
      if (!requestedFormat || !formatToEnum[requestedFormat]) continue
      const formatEnum = formatToEnum[requestedFormat]
      if (existingFormats.has(formatEnum)) continue
      if (!format.content) continue

      const buffer = format.isBase64Encoded
        ? Buffer.from(format.content, 'base64')
        : Buffer.from(format.content, 'utf-8')

      const fileExtension = format.fileExtension || requestedFormat
      const filename = `transcript-${job.id}.${fileExtension}`
      const artifact = await this.artifactService.createArtifactFromUpload({
        ownerId,
        campaignId,
        filename,
        mimeType: format.contentType || formatToMimeType[requestedFormat] || 'application/octet-stream',
        data: buffer,
        label: `Transcription ${requestedFormat.toUpperCase()}`,
        meta: {
          transcriptionJobId: job.id,
          format: requestedFormat,
        },
      })

      try {
        await prisma.transcriptionArtifact.create({
          data: {
            transcriptionJobId: job.id,
            artifactId: artifact.id,
            format: formatEnum,
          },
        })
        existingFormats.add(formatEnum)
      } catch (error) {
        const message = (error as Error & { code?: string }).code
        if (message !== 'P2002') {
          throw error
        }
      }
    }

    if (normalized.transcriptionText && !existingFormats.has('TXT')) {
      const artifact = await this.artifactService.createArtifactFromUpload({
        ownerId,
        campaignId,
        filename: `transcript-${job.id}.txt`,
        mimeType: 'text/plain',
        data: Buffer.from(normalized.transcriptionText, 'utf-8'),
        label: 'Transcription TXT',
        meta: {
          transcriptionJobId: job.id,
          format: 'txt',
        },
      })

      try {
        await prisma.transcriptionArtifact.create({
          data: {
            transcriptionJobId: job.id,
            artifactId: artifact.id,
            format: 'TXT',
          },
        })
        existingFormats.add('TXT')
      } catch (error) {
        const message = (error as Error & { code?: string }).code
        if (message !== 'P2002') {
          throw error
        }
      }
    }

    return true
  }
}

const normalizeResponsePayload = (
  response: TranscriptionResponsePayload
): NormalizedWebhookPayload => ({
  transcriptionId: response.transcriptionId,
  transcriptionText: response.text,
  formats:
    response.additionalFormats?.map((format) => ({
      requestedFormat: format.requestedFormat,
      fileExtension: format.fileExtension,
      contentType: format.contentType,
      isBase64Encoded: format.isBase64Encoded,
      content: format.content,
    })) || [],
})
