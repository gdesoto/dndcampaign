import { getHeader, getMethod, getQuery, getRequestURL, readBody, type H3Event } from 'h3'
import type { ApiKeyPermission } from '#shared/schemas/api-key'
import { classifyApiKeyRoute } from '#server/utils/api-key-policy-routes'
import { getApiAuth, requireApiUserSession } from '#server/utils/api-auth'
import { prisma } from '#server/db/prisma'
import { apiError } from '#server/utils/http'

type RoutePolicy = {
  permission: ApiKeyPermission
  campaignId?: string
}

const documentTypeFromQuery = (event: H3Event): 'SUMMARY' | 'TRANSCRIPT' | undefined => {
  const value = getQuery(event).type
  return value === 'SUMMARY' || value === 'TRANSCRIPT' ? value : undefined
}

const documentTypeFromBody = (body: unknown): 'SUMMARY' | 'TRANSCRIPT' | undefined => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const type = (body as { type?: unknown }).type
  return type === 'SUMMARY' || type === 'TRANSCRIPT' ? type : undefined
}

const campaignForPath = async (parts: string[]): Promise<string | null> => {
  if (parts[1] === 'campaigns' && parts[2]) return parts[2]
  if (parts[1] === 'sessions' && parts[2]) return (await prisma.session.findUnique({ where: { id: parts[2] }, select: { campaignId: true } }))?.campaignId ?? null
  if (parts[1] === 'quests' && parts[2]) return (await prisma.quest.findUnique({ where: { id: parts[2] }, select: { campaignId: true } }))?.campaignId ?? null
  if (parts[1] === 'glossary' && parts[2]) return (await prisma.glossaryEntry.findUnique({ where: { id: parts[2] }, select: { campaignId: true } }))?.campaignId ?? null
  if (parts[1] === 'encounters' && parts[2] && parts[2] !== 'stat-blocks' && parts[2] !== 'templates') return (await prisma.campaignEncounter.findUnique({ where: { id: parts[2] }, select: { campaignId: true } }))?.campaignId ?? null
  if (parts[1] === 'encounters' && parts[2] === 'stat-blocks' && parts[3]) return (await prisma.encounterStatBlock.findUnique({ where: { id: parts[3] }, select: { campaignId: true } }))?.campaignId ?? null
  if (parts[1] === 'encounters' && parts[2] === 'templates' && parts[3]) return (await prisma.encounterTemplate.findUnique({ where: { id: parts[3] }, select: { campaignId: true } }))?.campaignId ?? null
  return null
}

const policyForRequest = async (event: H3Event): Promise<RoutePolicy | null> => {
  const path = getRequestURL(event).pathname
  const parts = path.split('/').filter(Boolean)
  const method = getMethod(event)
  let documentType: 'SUMMARY' | 'TRANSCRIPT' | undefined
  let documentCampaignId: string | undefined
  if (parts[1] === 'sessions' && parts[3] === 'documents') {
    documentType = method === 'POST' ? documentTypeFromBody(await readBody(event)) : documentTypeFromQuery(event)
  } else if (parts[1] === 'documents' && parts[2]) {
    const document = await prisma.document.findUnique({ where: { id: parts[2] }, select: { type: true, campaignId: true } })
    if (!document) throw apiError(404, 'NOT_FOUND', 'Document not found')
    documentType = document.type === 'SUMMARY' ? 'SUMMARY' : document.type === 'TRANSCRIPT' ? 'TRANSCRIPT' : undefined
    documentCampaignId = document.campaignId
  }

  const route = classifyApiKeyRoute(path, method, documentType)
  if (!route) return null
  const campaignId = route.campaignId ?? documentCampaignId ?? await campaignForPath(parts)
  return { ...route, campaignId: campaignId ?? undefined }
}

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || !getHeader(event, 'authorization')) return
  await requireApiUserSession(event)
  const auth = getApiAuth(event)
  if (!auth || auth.kind !== 'bearer') return

  const policy = await policyForRequest(event)
  if (!policy) throw apiError(403, 'FORBIDDEN', 'This endpoint is not available to API keys')
  if (!auth.key.permissions.includes(policy.permission)) throw apiError(403, 'FORBIDDEN', 'API key does not grant this resource permission')

  const method = getMethod(event)
  const campaignId = policy.campaignId
  if (!campaignId && path !== '/api/campaigns') throw apiError(403, 'FORBIDDEN', 'API keys require a campaign-scoped endpoint')
  if (campaignId && !auth.key.campaigns.some((campaign) => campaign.campaignId === campaignId)) throw apiError(403, 'FORBIDDEN', 'API key does not grant access to this campaign')
  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { ownerId: true, members: { where: { userId: auth.key.userId }, select: { role: true }, take: 1 } } })
    const role = campaign?.ownerId === auth.key.userId ? 'OWNER' : campaign?.members[0]?.role
    if (!role) throw apiError(403, 'FORBIDDEN', 'Campaign access is denied')
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && role === 'VIEWER') throw apiError(403, 'FORBIDDEN', 'Campaign write access is denied')
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    await prisma.activityLog.create({
      data: {
        actorUserId: auth.key.userId,
        campaignId: campaignId ?? undefined,
        scope: campaignId ? 'CAMPAIGN' : 'SYSTEM',
        action: 'API_KEY_WRITE_ATTEMPT',
        targetType: 'ApiKey',
        targetId: auth.key.id,
        summary: `${method} ${path}`,
        metadata: { apiKeyId: auth.key.id, path, method },
      },
    })
  }
})
