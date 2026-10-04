import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { Readable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { db } from '#server/db/client'
import { document as documentTable, transcriptionJob, transcriptionArtifact } from '#server/db/schema'
import { isSqliteUniqueConstraintError } from '#server/db/errors'
import { streamToBuffer } from '#server/utils/multipart'
import { apiError } from '#server/utils/http'
import { getStorageAdapter } from '#server/services/storage/storage.factory'
import { ArtifactService } from '#server/services/artifact.service'
import { DocumentService } from '#server/services/document.service'
import { RecordingService } from '#server/services/recording.service'
import { toVtt } from '#shared/utils/transcript'
import type {
  TranscriptionArtifactFormat,
  TranscriptionArtifact,
  Artifact,
  Recording,
  Session,
  TranscriptionJob,
  TranscriptionStatus,
} from '#server/db/schema'

type StartTranscriptionInput = {
  recordingId: string
  sessionId: string
  campaignId: string
  storageKey: string
  modelId: string
  formats: string[]
  numSpeakers?: number
  diarizationThreshold?: number
  keyterms?: string[]
  diarize: boolean
  tagAudioEvents?: boolean
  languageCode?: string
}

type ParseWebhookPayloadInput = {
  rawBodyText: string
  webhookSecret?: string
  signature?: string
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

type TranscriptionJobWithArtifacts = TranscriptionJob & { artifacts: (TranscriptionArtifact & { artifact: Artifact })[] }
type LocalTranscriptionJob = TranscriptionJobWithArtifacts & { recording: Recording & { session: Session } }
type SubtitleTargetRecording = Recording & { session: Session }

const parseJsonArray = (value: string | null): unknown[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const toTranscriptionJobDto = (job: TranscriptionJobWithArtifacts) => ({
  id: job.id,
  status: job.status,
  requestId: job.requestId,
  externalJobId: job.externalJobId,
  modelId: job.modelId,
  languageCode: job.languageCode,
  numSpeakers: job.numSpeakers,
  diarize: job.diarize,
  tagAudioEvents: job.tagAudioEvents,
  requestedFormats: parseJsonArray(job.requestedFormats),
  keyterms: parseJsonArray(job.keyterms),
  errorMessage: job.errorMessage,
  completedAt: job.completedAt,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  artifacts: job.artifacts.map((entry) => ({
    id: entry.id,
    format: entry.format,
    artifact: {
      id: entry.artifact.id,
      storageKey: entry.artifact.storageKey,
      mimeType: entry.artifact.mimeType,
      byteSize: entry.artifact.byteSize,
      createdAt: entry.artifact.createdAt,
    },
  })),
})

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

  static async applyTranscript(input: {
    job: LocalTranscriptionJob
    artifactId?: string
    createdByUserId: string
  }) {
    const selected = input.artifactId
      ? input.job.artifacts.find((entry) => entry.artifactId === input.artifactId)
      : input.job.artifacts.find((entry) => entry.format === 'TXT')

    if (!selected) {
      throw apiError(404, 'NOT_FOUND', 'Transcript artifact not found')
    }

    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(selected.artifact.storageKey)
    const content = (await streamToBuffer(stream)).toString('utf-8')
    const title = input.job.recording.session.title
      ? `Transcript: ${input.job.recording.session.title}`
      : 'Transcript'

    const document = await new DocumentService().upsertForSession(
      input.job.recording.sessionId,
      'TRANSCRIPT',
      {
        campaignId: input.job.recording.session.campaignId,
        recordingId: input.job.recordingId,
        title,
        content,
        format: 'PLAINTEXT',
        source: 'ELEVENLABS_IMPORT',
        createdByUserId: input.createdByUserId,
      }
    )

    // The response has historically reflected the upsert before this association.
    if (document.recordingId !== input.job.recordingId) {
      db.update(documentTable).set({ recordingId: input.job.recordingId }).where(eq(documentTable.id, document.id)).returning().get()!
    }

    return document
  }

  static async attachSubtitles(input: {
    job: LocalTranscriptionJob
    artifactId: string
    targetRecording: SubtitleTargetRecording
    ownerId: string
  }) {
    if (input.targetRecording.kind !== 'VIDEO') {
      throw apiError(400, 'VALIDATION_ERROR', 'Subtitles can only be attached to video recordings')
    }

    const selected = input.job.artifacts.find((entry) => entry.artifactId === input.artifactId)
    if (!selected || selected.format !== 'SRT') {
      throw apiError(404, 'NOT_FOUND', 'Subtitle artifact not found')
    }

    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(selected.artifact.storageKey)
    const vttContent = toVtt((await streamToBuffer(stream)).toString('utf-8'))

    return new RecordingService().attachVttFromStream({
      ownerId: input.ownerId,
      campaignId: input.targetRecording.session.campaignId,
      recordingId: input.targetRecording.id,
      filename: 'subtitles.vtt',
      mimeType: 'text/vtt',
      stream: Readable.from(vttContent),
    })
  }

  async parseWebhookPayload(input: ParseWebhookPayloadInput) {
    if (input.webhookSecret) {
      if (!input.signature) {
        const error = new Error('Missing webhook signature')
        ;(error as Error & { code?: string }).code = 'MISSING_SIGNATURE'
        throw error
      }

      try {
        return await this.client.webhooks.constructEvent(
          input.rawBodyText,
          input.signature,
          input.webhookSecret
        )
      } catch {
        const error = new Error('Invalid webhook signature')
        ;(error as Error & { code?: string }).code = 'INVALID_SIGNATURE'
        throw error
      }
    }

    try {
      return JSON.parse(input.rawBodyText)
    } catch {
      const error = new Error('Invalid JSON body')
      ;(error as Error & { code?: string }).code = 'INVALID_JSON'
      throw error
    }
  }

  async startTranscription(input: StartTranscriptionInput) {
    const additionalFormats = input.formats
      .map((format) => requestFormatMap[format])
      .filter((value): value is { format: string } => Boolean(value))

    const job = db.insert(transcriptionJob).values({
        recordingId: input.recordingId,
        provider: 'ELEVENLABS',
        status: 'SENDING',
        modelId: input.modelId,
        languageCode: input.languageCode,
        numSpeakers: input.diarize ? input.numSpeakers : undefined,
        diarize: input.diarize,
        tagAudioEvents: input.tagAudioEvents ?? false,
        requestedFormats: JSON.stringify(input.formats),
        keyterms: input.keyterms ? JSON.stringify(input.keyterms) : undefined,
      }).returning().get()!

    const adapter = getStorageAdapter()
    const { stream } = await adapter.getObject(input.storageKey)

    try {
      const response = (await this.client.speechToText.convert({
        modelId: input.modelId as any,
        file: stream,
        languageCode: input.languageCode,
        numSpeakers: input.diarize ? input.numSpeakers : undefined,
        diarizationThreshold:
          input.diarize && typeof input.numSpeakers !== 'number'
            ? input.diarizationThreshold
            : undefined,
        diarize: input.diarize,
        keyterms: input.keyterms,
        tagAudioEvents: input.tagAudioEvents,
        additionalFormats: additionalFormats as any,
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
        const updated = db.update(transcriptionJob).set({
            status: 'COMPLETED',
            externalJobId: response.transcriptionId,
            completedAt: new Date(),
          }).where(eq(transcriptionJob.id, job.id)).returning().get()!
        return updated
      }

      const updated = db.update(transcriptionJob).set({
          status: 'SENT',
          requestId: (response as { requestId?: string }).requestId,
          externalJobId: (response as { transcriptionId?: string }).transcriptionId,
        }).where(eq(transcriptionJob.id, job.id)).returning().get()!

      return updated
    } catch (error) {
      db.update(transcriptionJob).set({
          status: 'FAILED',
          errorMessage: (error as Error & { message?: string }).message || 'Transcription failed',
        }).where(eq(transcriptionJob.id, job.id)).returning().get()!
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
      job = (db.query.transcriptionJob.findFirst({ where: eq(transcriptionJob.externalJobId, normalized.transcriptionId), with: {
          recording: { with: { session: { with: { campaign: true } } } },
          artifacts: true,
        } }).sync() ?? null)
    }

    if (!job && jobId && typeof jobId === 'string') {
      job = (db.query.transcriptionJob.findFirst({ where: eq(transcriptionJob.id, jobId), with: {
          recording: { with: { session: { with: { campaign: true } } } },
          artifacts: true,
        } }).sync() ?? null)
    }

    if (!job && normalized.requestId) {
      job = (db.query.transcriptionJob.findFirst({ where: eq(transcriptionJob.requestId, normalized.requestId), with: {
          recording: { with: { session: { with: { campaign: true } } } },
          artifacts: true,
        } }).sync() ?? null)
    }

    if (!job) {
      return null
    }

    if (job.status === 'COMPLETED') {
      return job
    }

    await this.storeArtifacts(job.id, normalized)

    const status: TranscriptionStatus = 'COMPLETED'
    const completedJob = job
    const updated = db.transaction((tx) => {
      tx.update(transcriptionJob).set({
        status,
        externalJobId: normalized.transcriptionId || completedJob.externalJobId,
        requestId: normalized.requestId || completedJob.requestId,
        completedAt: new Date(),
      }).where(eq(transcriptionJob.id, completedJob.id)).run()
      return tx.query.transcriptionJob.findFirst({
        where: eq(transcriptionJob.id, completedJob.id),
        with: { recording: { with: { session: { with: { campaign: true } } } }, artifacts: true },
      }).sync()!
    }, { behavior: 'immediate' })

    return updated
  }

  async fetchTranscription(jobId: string) {
    const job = (db.query.transcriptionJob.findFirst({ where: eq(transcriptionJob.id, jobId) }).sync() ?? null)
    if (!job?.externalJobId) return null

    const response = (await this.client.speechToText.transcripts.get(
      job.externalJobId
    )) as TranscriptionResponsePayload

    await this.storeArtifacts(job.id, normalizeResponsePayload(response))

    return db.update(transcriptionJob).set({
        status: 'COMPLETED',
        completedAt: new Date(),
      }).where(eq(transcriptionJob.id, job.id)).returning().get()!
  }

  async fetchTranscriptionByExternalId(jobId: string, externalJobId: string) {
    const response = (await this.client.speechToText.transcripts.get(
      externalJobId
    )) as TranscriptionResponsePayload

    await this.storeArtifacts(jobId, normalizeResponsePayload(response))

    return db.update(transcriptionJob).set({
        status: 'COMPLETED',
        completedAt: new Date(),
      }).where(eq(transcriptionJob.id, jobId)).returning().get()!
  }

  private async storeArtifacts(jobId: string, normalized: NormalizedWebhookPayload) {
    const job = (db.query.transcriptionJob.findFirst({ where: eq(transcriptionJob.id, jobId), with: {
        recording: { with: { session: { with: { campaign: true } } } },
        artifacts: true,
      } }).sync() ?? null)
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
        db.insert(transcriptionArtifact).values({
            transcriptionJobId: job.id,
            artifactId: artifact.id,
            format: formatEnum,
          }).returning().get()!
        existingFormats.add(formatEnum)
      } catch (error) {
        await this.deleteArtifactBestEffort(artifact.id)
        if (!isSqliteUniqueConstraintError(error)) {
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
        db.insert(transcriptionArtifact).values({
            transcriptionJobId: job.id,
            artifactId: artifact.id,
            format: 'TXT',
          }).returning().get()!
        existingFormats.add('TXT')
      } catch (error) {
        await this.deleteArtifactBestEffort(artifact.id)
        if (!isSqliteUniqueConstraintError(error)) {
          throw error
        }
      }
    }

    return true
  }

  private async deleteArtifactBestEffort(artifactId: string) {
    try {
      await this.artifactService.deleteArtifact(artifactId)
    } catch {
      // Best-effort cleanup to avoid leaking orphan transcription artifacts.
    }
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

