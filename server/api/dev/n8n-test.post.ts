import { readBody } from 'h3'
import { ok, fail } from '#server/utils/http'
import { prisma } from '#server/db/prisma'
import { n8nWebhookPayloadSchema } from '#shared/schemas/summarization'

type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const validateSummaryContent = (value: unknown, errors: string[], warnings: string[]) => {
  if (typeof value === 'string') return
  if (!isRecord(value)) {
    errors.push('summaryContent must be a string or object')
    return
  }
  if ('fullSummary' in value && typeof value.fullSummary !== 'string') {
    warnings.push('summaryContent.fullSummary should be a string')
  }
  if ('highlights' in value && !Array.isArray(value.highlights)) {
    warnings.push('summaryContent.highlights should be an array of strings')
  }
  if (Array.isArray(value.highlights) && value.highlights.some((item) => typeof item !== 'string')) {
    warnings.push('summaryContent.highlights should only include strings')
  }
  if ('sessionTags' in value && !Array.isArray(value.sessionTags)) {
    warnings.push('summaryContent.sessionTags should be an array of strings')
  }
  if (Array.isArray(value.sessionTags) && value.sessionTags.some((item) => typeof item !== 'string')) {
    warnings.push('summaryContent.sessionTags should only include strings')
  }
}

const validateSuggestions = (value: unknown, warnings: string[]) => {
  if (!value) return
  if (!isRecord(value)) {
    warnings.push('suggestions should be an object')
    return
  }
  const lists = ['quests', 'milestones']
  for (const key of lists) {
    if (key in value && !Array.isArray(value[key])) {
      warnings.push(`suggestions.${key} should be an array`)
    }
  }
  if (value.glossary && isRecord(value.glossary)) {
    const glossaryLists = ['pcs', 'npcs', 'items', 'locations']
    for (const key of glossaryLists) {
      if (key in value.glossary && !Array.isArray(value.glossary[key])) {
        warnings.push(`suggestions.glossary.${key} should be an array`)
      }
    }
  }
}
function scanZod(schema: any, path: string[] = []) {
  console.log('scanZod Start');
  // Anything that isn't a Zod schema instance will fail here
  if (!schema || typeof schema !== "object") {
    console.log("❌ Not an object at", path.join(".") || "<root>", schema)
    return
  }

  const z = schema._zod
  if (!z) {
    console.log("❌ Missing _zod at", path.join(".") || "<root>", schema)
    return
  }

  const def = z.def
  const type = def?.type

  // Helpful breadcrumbs
  // console.log("✅", path.join(".") || "<root>", type)
  console.log('scanZod 1');

  switch (type) {
    case "object": {
      const shape = def.shape ?? {}
      for (const [k, v] of Object.entries(shape)) scanZod(v, [...path, k])
      if (def.catchall) scanZod(def.catchall, [...path, "<catchall>"])
      break
    }

    case "optional":
    case "nullable":
    case "readonly":
    case "default":
    case "prefault":
    case "catch":
    case "pipe":
    case "effects": {
      // Different wrappers use different property names across minors; check the usual suspects
      const inner =
        def.innerType ?? def.schema ?? def.in ?? def.out ?? def.source ?? def.target
      scanZod(inner, [...path, `<${type}>`])
      break
    }

    case "array": {
      scanZod(def.element, [...path, "<element>"])
      break
    }

    case "record": {
      if (def.keyType) scanZod(def.keyType, [...path, "<key>"])
      if (def.valueType) scanZod(def.valueType, [...path, "<value>"])
      break
    }

    case "union": {
      for (let i = 0; i < (def.options?.length ?? 0); i++) {
        scanZod(def.options[i], [...path, `<option ${i}>`])
      }
      break
    }

    case "discriminatedUnion": {
      // In v4 this is usually a Map of options
      const opts = def.options
      if (opts?.forEach) {
        let i = 0
        opts.forEach((v: any, k: any) => {
          scanZod(v, [...path, `<disc ${String(k)} #${i++}>`])
        })
      }
      break
    }

    // primitives etc
    default:
      break
  }
  console.log('scanZod 1');
}

const validateN8nResponse = (response: unknown): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!isRecord(response)) {
    return { valid: false, errors: ['Response must be a JSON object'], warnings }
  }

  if (!response.trackingId || typeof response.trackingId !== 'string') {
    errors.push('trackingId is required and must be a string')
  }

  if ('status' in response) {
    const status = String(response.status || '').toUpperCase()
    const allowed = ['COMPLETED', 'FAILED', 'PROCESSING']
    if (status && !allowed.includes(status)) {
      warnings.push(`status should be one of ${allowed.join(', ')}`)
    }
  }

  if ('summaryContent' in response) {
    validateSummaryContent(response.summaryContent, errors, warnings)
  }

  validateSuggestions(response.suggestions, warnings)
  if (!('summaryContent' in response) && !('suggestions' in response)) {
    errors.push('summaryContent or suggestions is required')
  }
  if (isRecord(response.suggestions) && response.suggestions.session) {
    const sessionSuggestion = response.suggestions.session
    if (!isRecord(sessionSuggestion)) {
      warnings.push('suggestions.session should be an object')
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUserSession(event)

  if (!import.meta.dev) {
    return fail(403, 'FORBIDDEN', 'Dev-only endpoint')
  }

  const config = useRuntimeConfig()
  const body = await readBody<{
    webhookUrlOverride?: string
    promptProfile?: string
    useZod?: boolean
    campaignId?: string
    sessionId?: string
  }>(event)
  const webhookUrl = body?.webhookUrlOverride || config.n8n?.webhookUrlDefault

  if (!webhookUrl) {
    return fail(400, 'VALIDATION_ERROR', 'n8n webhook URL is not configured')
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
      return fail(404, 'NOT_FOUND', 'Campaign/session not found')
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

    const useZod = Boolean(body?.useZod)
    let zodValid: boolean | null = null
    let zodIssues: string | null = null
    if (useZod) {
      try {
        const parsed = n8nWebhookPayloadSchema.safeParse(response)
        zodValid = parsed.success
        if (!parsed.success) {
          zodIssues = JSON.stringify(parsed.error.issues, null, 2)
        }
      } catch (error) {
        return fail(500, 'ZOD_CRASH', 'Zod validation crashed', {
          message: (error as Error & { message?: string }).message || 'Unknown Zod error',
        })
      }
    }

    const validation = validateN8nResponse(response)
    if (!validation.valid || (useZod && zodValid === false)) {
      return fail(400, 'INVALID_RESPONSE', 'n8n response did not match expected schema', {
        errors: JSON.stringify(validation.errors, null, 2),
        warnings: JSON.stringify(validation.warnings, null, 2),
        receivedKeys: JSON.stringify(Object.keys((response as Record<string, unknown>) || {})),
        zodValid: zodValid === null ? 'not-run' : String(zodValid),
        zodIssues: zodIssues || '',
      })
    }

    return ok({
      valid: true,
      trackingId,
      summaryContent: (response as Record<string, unknown>).summaryContent,
      suggestions: (response as Record<string, unknown>).suggestions || null,
      meta: (response as Record<string, unknown>).meta || null,
      warnings: validation.warnings,
      zodValid: zodValid ?? 'not-run',
    })
  } catch (error) {
    return fail(
      500,
      'N8N_TEST_FAILED',
      (error as Error & { message?: string }).message || 'Unable to reach n8n webhook.'
    )
  }
})
