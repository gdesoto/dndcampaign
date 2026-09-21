import type { ApiKeyPermission } from '../../shared/schemas/api-key'

const readMethods = new Set(['GET', 'HEAD'])
const writeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const resourcePermission = (resource: 'characters' | 'encounters' | 'glossary' | 'quests' | 'sessions' | 'summaries' | 'transcripts', method: string): ApiKeyPermission | null => {
  if (readMethods.has(method)) return `${resource}.read` as ApiKeyPermission
  if (writeMethods.has(method)) return `${resource}.write` as ApiKeyPermission
  return null
}

const campaignChildPolicy = (parts: string[], method: string): ApiKeyPermission | null => {
  const resource = parts[3]
  if (!resource) return null
  if (resource === 'encounters') {
    if (parts.length === 5 && (parts[4] === 'stat-blocks' || parts[4] === 'templates')) return method === 'GET' || method === 'HEAD' || method === 'POST' ? resourcePermission('encounters', method) : null
    if (parts.length === 4) return method === 'GET' || method === 'HEAD' || method === 'POST' ? resourcePermission('encounters', method) : null
    return null
  }
  if (resource === 'characters' || resource === 'glossary' || resource === 'quests' || resource === 'sessions') {
    if (parts.length === 4) return method === 'GET' || method === 'HEAD' || method === 'POST' ? resourcePermission(resource, method) : null
    if (resource === 'characters' && parts.length === 5) return method === 'PATCH' || method === 'DELETE' ? resourcePermission(resource, method) : null
  }
  return null
}

const globalPolicy = (parts: string[], method: string, documentType?: 'SUMMARY' | 'TRANSCRIPT'): ApiKeyPermission | null => {
  const resource = parts[1]
  if (!resource) return null
  if (resource === 'sessions') {
    if (parts.length === 3) return method === 'GET' || method === 'HEAD' || method === 'PATCH' ? resourcePermission('sessions', method) : null
    if (parts.length === 4 && parts[3] === 'transcript') return method === 'GET' || method === 'HEAD' ? 'transcripts.read' : null
    if (parts.length === 4 && parts[3] === 'documents') {
      if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return null
      return documentType ? resourcePermission(documentType === 'SUMMARY' ? 'summaries' : 'transcripts', method) : null
    }
    return null
  }
  if (resource === 'documents' && parts.length === 3 && documentType) {
    if (documentType === 'SUMMARY' && method !== 'GET' && method !== 'HEAD' && method !== 'PATCH') return null
    if (documentType === 'TRANSCRIPT' && method !== 'GET' && method !== 'HEAD' && method !== 'PATCH' && method !== 'DELETE') return null
    return resourcePermission(documentType === 'SUMMARY' ? 'summaries' : 'transcripts', method)
  }
  if ((resource === 'glossary' || resource === 'quests') && parts.length === 3 && (method === 'PATCH' || method === 'DELETE')) return resourcePermission(resource, method)
  if (resource === 'encounters') {
    if (parts[2] === 'stat-blocks' || parts[2] === 'templates') {
      if (parts.length === 4) return method === 'PATCH' || method === 'DELETE' ? 'encounters.write' : null
      if (parts[2] === 'templates' && parts.length === 5 && parts[4] === 'instantiate') return method === 'POST' ? 'encounters.write' : null
      return null
    }
    if (parts.length === 3) return method === 'GET' || method === 'HEAD' || method === 'PATCH' || method === 'DELETE' ? resourcePermission('encounters', method) : null
    if (parts.length === 4 && parts[3] === 'summary') return method === 'GET' || method === 'HEAD' ? 'encounters.read' : null
    if (parts.length === 4 && parts[3] === 'combatants') return method === 'GET' || method === 'HEAD' || method === 'POST' ? resourcePermission('encounters', method) : null
    if (parts.length === 4 && parts[3] === 'events') return method === 'GET' || method === 'HEAD' ? 'encounters.read' : null
    if (parts.length === 4 && (parts[3] === 'initiative' || parts[3] === 'turn')) return method === 'PATCH' ? 'encounters.write' : null
    if (parts.length === 5 && parts[3] === 'events' && parts[4] === 'note') return method === 'POST' ? 'encounters.write' : null
    if (parts.length === 5 && parts[3] === 'combatants') return method === 'PATCH' || method === 'DELETE' ? 'encounters.write' : null
    if (parts.length === 6 && parts[3] === 'combatants' && parts[5] === 'conditions') return method === 'POST' ? 'encounters.write' : null
    if (parts.length === 7 && parts[3] === 'combatants' && parts[5] === 'conditions') return method === 'PATCH' || method === 'DELETE' ? 'encounters.write' : null
    return null
  }
  return null
}

export const classifyApiKeyRoute = (path: string, method: string, documentType?: 'SUMMARY' | 'TRANSCRIPT'): { permission: ApiKeyPermission; campaignId?: string } | null => {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'api') return null
  if (parts[1] === 'campaigns' && parts.length === 2) return method === 'GET' || method === 'HEAD' ? { permission: 'campaign.read' } : null
  if (parts[1] === 'campaigns' && parts[2]) {
    if (parts.length === 3) {
      if (method === 'GET' || method === 'HEAD') return { permission: 'campaign.read', campaignId: parts[2] }
      if (method === 'PATCH') return { permission: 'campaign.write', campaignId: parts[2] }
      return null
    }
    const permission = campaignChildPolicy(parts, method)
    return permission ? { permission, campaignId: parts[2] } : null
  }
  const permission = globalPolicy(parts, method, documentType)
  return permission ? { permission } : null
}
