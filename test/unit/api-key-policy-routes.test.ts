import { describe, expect, it } from 'vitest'
import { classifyApiKeyRoute } from '../../server/utils/api-key-policy-routes'

describe('API key route policy', () => {
  it('denies untyped session document listing and NOTES documents', () => {
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'GET')).toBeNull()
    expect(classifyApiKeyRoute('/api/documents/document-1', 'GET')).toBeNull()
  })

  it('classifies document creation from the validated body type', () => {
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'POST', 'SUMMARY')).toMatchObject({ permission: 'summaries.write' })
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'POST', 'TRANSCRIPT')).toMatchObject({ permission: 'transcripts.write' })
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'POST')).toBeNull()
  })

  it('keeps document access scoped to document type', () => {
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'GET', 'SUMMARY')).toMatchObject({ permission: 'summaries.read' })
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'GET', 'TRANSCRIPT')).toMatchObject({ permission: 'transcripts.read' })
    expect(classifyApiKeyRoute('/api/documents/document-1', 'PATCH', 'SUMMARY')).toMatchObject({ permission: 'summaries.write' })
    expect(classifyApiKeyRoute('/api/documents/document-1', 'DELETE', 'SUMMARY')).toBeNull()
  })

  it('allows only the supported stat block and template routes', () => {
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/encounters/stat-blocks', 'GET')).toMatchObject({ permission: 'encounters.read', campaignId: 'campaign-1' })
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/encounters/templates', 'POST')).toMatchObject({ permission: 'encounters.write', campaignId: 'campaign-1' })
    expect(classifyApiKeyRoute('/api/encounters/stat-blocks/stat-1', 'PATCH')).toMatchObject({ permission: 'encounters.write' })
    expect(classifyApiKeyRoute('/api/encounters/templates/template-1', 'DELETE')).toMatchObject({ permission: 'encounters.write' })
    expect(classifyApiKeyRoute('/api/encounters/stat-blocks/stat-1/unknown', 'PATCH')).toBeNull()
  })

  it('denies unsupported descendants and methods by default', () => {
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/encounters/future', 'GET')).toBeNull()
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/encounters/future', 'PATCH')).toBeNull()
    expect(classifyApiKeyRoute('/api/encounters/encounter-1/combatants', 'PATCH')).toMatchObject({ permission: 'encounters.write' })
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/public/access', 'GET')).toBeNull()
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/glossary/entry-1', 'PATCH')).toBeNull()
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/quests/quest-1', 'DELETE')).toBeNull()
    expect(classifyApiKeyRoute('/api/campaigns/campaign-1/sessions/session-1', 'PATCH')).toBeNull()
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'PATCH', 'SUMMARY')).toBeNull()
    expect(classifyApiKeyRoute('/api/sessions/session-1/documents', 'DELETE', 'TRANSCRIPT')).toBeNull()
  })
})
