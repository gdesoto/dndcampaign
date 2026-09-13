import { readBody, isError } from 'h3'
import { ok, apiError } from '#server/utils/http'
import { prisma } from '#server/db/prisma'
import { n8nWebhookPayloadSchema } from '#shared/schemas/summarization'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)

  if (!import.meta.dev) {
    throw apiError(403, 'FORBIDDEN', 'Dev-only endpoint')
  }

  const config = useRuntimeConfig()
  const body = await readBody<{
    webhookUrlOverride?: string
    promptProfile?: string
    campaignId?: string
    sessionId?: string
  }>(event)
  const webhookUrl = body?.webhookUrlOverride || config.n8n?.webhookUrlDefault

  if (!webhookUrl) {
    throw apiError(400, 'VALIDATION_ERROR', 'n8n webhook URL is not configured')
  }

  let campaignName = 'Dev Campaign'
  let sessionTitle = 'Dev Session'
  let sessionNumber: number | null = 0
  let playedAt: string | null = null
  let transcriptContent =
    'Dev test transcript. The party meets a mysterious merchant and receives a quest to find a lost relic.'
  let documentId = 'dev-document'
  let existingGlossary: Record<string, unknown[]> = {
    pcs: [],
    npcs: [],
    items: [],
    locations: [],
  }
  let quests: Record<string, unknown>[] = []
  let milestones: Record<string, unknown>[] = []

  if (body?.campaignId && body?.sessionId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, ownerId: sessionUser.user.id },
    })
    const session = await prisma.session.findFirst({
      where: { id: body.sessionId, campaignId: body.campaignId },
    })

    if (!campaign || !session) {
      throw apiError(404, 'NOT_FOUND', 'Campaign/session not found')
    }

    campaignName = campaign.name
    sessionTitle = session.title
    sessionNumber = session.sessionNumber ?? null
    playedAt = session.playedAt ? session.playedAt.toISOString() : null

    const glossaryEntries = await prisma.glossaryEntry.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, type: true, name: true, aliases: true, description: true },
    })
    quests = await prisma.quest.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, title: true, status: true, description: true, progressNotes: true },
    })
    milestones = await prisma.milestone.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, title: true, description: true, isComplete: true },
    })

    existingGlossary = {
      pcs: glossaryEntries.filter((entry) => entry.type === 'PC'),
      npcs: glossaryEntries.filter((entry) => entry.type === 'NPC'),
      items: glossaryEntries.filter((entry) => entry.type === 'ITEM'),
      locations: glossaryEntries.filter((entry) => entry.type === 'LOCATION'),
    }

    const transcriptDoc = await prisma.document.findFirst({
      where: { sessionId: session.id, type: 'TRANSCRIPT' },
      include: { currentVersion: true },
    })
    if (transcriptDoc?.currentVersion?.content) {
      transcriptContent = transcriptDoc.currentVersion.content
      documentId = transcriptDoc.id
    }
  }

  const trackingId = `devtest_${Date.now()}`
  const payload = {
    trackingId,
    campaignId: body?.campaignId || 'dev-campaign',
    sessionId: body?.sessionId || 'dev-session',
    documentId,
    transcript: {
      format: 'PLAINTEXT',
      readOnly: true,
      content: transcriptContent,
      hash: 'sha256:devtest',
    },
    promptProfile: body?.promptProfile || 'session-summary+highlights+quests+milestones+glossary+pcs+npcs',
    context: {
      campaignName,
      sessionTitle,
      sessionNumber,
      playedAt,
      existingGlossary,
      quests,
      milestones,
    },
    options: {
      mode: 'sync',
    },
  }

  try {
    const response = await $fetch(webhookUrl, {
      method: 'POST',
      body: payload,
      headers: config.n8n?.webhookSecret
        ? { 'x-webhook-secret': config.n8n.webhookSecret }
        : undefined,
    })

    const parsed = n8nWebhookPayloadSchema.safeParse(response)
    if (!parsed.success) {
      throw apiError(400, 'INVALID_RESPONSE', 'n8n response did not match expected schema', {
        issues: JSON.stringify(parsed.error.issues, null, 2),
      })
    }

    return ok({
      valid: true,
      trackingId,
      summaryContent: (response as Record<string, unknown>).summaryContent,
      suggestions: (response as Record<string, unknown>).suggestions || null,
      meta: (response as Record<string, unknown>).meta || null,
    })
  } catch (error) {
    if (isError(error)) throw error
    throw apiError(500,
      'N8N_TEST_FAILED',
      (error as Error & { message?: string }).message || 'Unable to reach n8n webhook.'
    )
  }
})
