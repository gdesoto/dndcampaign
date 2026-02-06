import type { H3Event } from 'h3'
import { getRequestHeader, readBody } from 'h3'
import { ok, fail } from '#server/utils/http'
import { n8nWebhookPayloadSchema } from '#shared/schemas/summarization'
import { SummaryService } from '#server/services/summary.service'

const extractSecret = (event: H3Event) => {
  const headers = ['x-webhook-secret', 'x-n8n-webhook-secret']
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
  const expectedSecret = config.n8n?.webhookSecret
  if (expectedSecret) {
    const provided = extractSecret(event)
    if (provided !== expectedSecret) {
      return fail(401, 'UNAUTHORIZED', 'Invalid webhook secret')
    }
  }

  const payload = await readBody(event)
  const parsed = n8nWebhookPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid webhook payload')
  }

  const service = new SummaryService()
  const job = await service.handleSummaryResult({
    trackingId: parsed.data.trackingId,
    status: parsed.data.status,
    summaryContent: parsed.data.summaryContent,
    suggestions: parsed.data.suggestions,
    meta: parsed.data.meta,
  })

  console.info('[summary] webhook received', {
    trackingId: parsed.data.trackingId,
    jobId: job?.id || null,
  })

  return ok({ received: true, jobId: job?.id || null })
})
