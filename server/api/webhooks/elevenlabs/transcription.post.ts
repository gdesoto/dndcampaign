import { getRequestHeader, readRawBody } from 'h3'
import { ok, fail } from '#server/utils/http'
import { TranscriptionService } from '#server/services/transcription.service'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const rawBody = await readRawBody(event, false)
  if (!rawBody) {
    return fail(400, 'VALIDATION_ERROR', 'Missing webhook body')
  }
  const rawBodyText = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8')
  const service = new TranscriptionService(config.elevenlabs?.apiKey || '')

  let payload: unknown
  try {
    payload = await service.parseWebhookPayload({
      rawBodyText,
      webhookSecret: config.elevenlabs?.webhookSecret,
      signature: getRequestHeader(event, 'elevenlabs-signature') || undefined,
    })
  } catch (error) {
    const code = (error as Error & { code?: string }).code
    if (code === 'MISSING_SIGNATURE' || code === 'INVALID_SIGNATURE') {
      return fail(401, 'UNAUTHORIZED', (error as Error).message)
    }
    return fail(400, 'VALIDATION_ERROR', (error as Error).message)
  }

  const job = await service.ingestWebhook(payload)

  return ok({ received: true, jobId: job?.id || null })
})
