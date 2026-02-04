import type { H3Event } from 'h3'
import { getRequestHeader, readBody } from 'h3'
import { ok, fail } from '#server/utils/http'
import { TranscriptionService } from '#server/services/transcription.service'

const extractSecret = (event: H3Event) => {
  const headers = [
    'x-webhook-secret',
    'x-elevenlabs-webhook-secret',
    'xi-webhook-secret',
  ]
  for (const header of headers) {
    const value = getRequestHeader(event, header)
    if (value) return String(value)
  }

  const url = event.node.req.url || ''
  const match = url.match(/[?&]secret=([^&]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const expectedSecret = config.elevenLabs?.webhookSecret
  if (expectedSecret) {
    const provided = extractSecret(event)
    if (provided !== expectedSecret) {
      return fail(401, 'UNAUTHORIZED', 'Invalid webhook secret')
    }
  }

  const payload = await readBody(event)
  const service = new TranscriptionService(config.elevenLabs?.apiKey || '')
  const job = await service.ingestWebhook(payload)

  return ok({ received: true, jobId: job?.id || null })
})
