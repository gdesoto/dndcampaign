import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyApiKeyRoute } from '../../server/utils/api-key-policy-routes'

const contract = JSON.parse(readFileSync(resolve(process.cwd(), 'public/openapi.json'), 'utf8')) as {
  components: { securitySchemes: Record<string, { type: string, scheme?: string }> , schemas: Record<string, unknown> }
  paths: Record<string, Record<string, { security?: Array<Record<string, unknown>>, operationId?: string }>>
}

describe('agent API OpenAPI contract', () => {
  it('documents bearer authentication and the transcript response contract', () => {
    expect(contract.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' })
    expect(contract.paths['/api/sessions/{sessionId}/transcript'].get.operationId).toBe('get_api_sessions_sessionId_transcript')
    expect(contract.paths['/api/sessions/{sessionId}/transcript'].get.security).toEqual(expect.arrayContaining([{ bearerAuth: [] }]))
    expect(contract.components.schemas).toHaveProperty('TranscriptReadResponse')
    expect(contract.components.schemas).toHaveProperty('TranscriptSearchResponse')
  })

  it('documents cookie-only key management and encounter agent routes', () => {
    expect(contract.paths['/api/account/api-keys'].get.security).toEqual([{ cookieAuth: [] }])
    expect(contract.paths['/api/account/api-keys'].post.security).toEqual([{ cookieAuth: [] }])
    expect(contract.paths['/api/account/api-keys/{keyId}'].patch.security).toEqual([{ cookieAuth: [] }])
    expect(contract.paths['/api/account/api-keys/{keyId}'].delete.security).toEqual([{ cookieAuth: [] }])
    for (const path of [
      '/api/campaigns/{campaignId}/encounters/stat-blocks',
      '/api/campaigns/{campaignId}/encounters/templates',
      '/api/encounters/stat-blocks/{statBlockId}',
      '/api/encounters/templates/{templateId}',
      '/api/encounters/templates/{templateId}/instantiate',
    ]) {
      expect(contract.paths[path]).toBeDefined()
      expect(Object.values(contract.paths[path]).some((operation) => operation.security?.some((scheme) => Object.hasOwn(scheme, 'bearerAuth')))).toBe(true)
    }
    expect(contract.components.schemas).toHaveProperty('ApiKeyCreateRequest')
    expect(contract.components.schemas).toHaveProperty('ApiKeyCreateData')
  })

  it('does not advertise bearer keys for unsupported routes', () => {
    for (const [path, methods] of Object.entries(contract.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation.security?.some((scheme) => Object.hasOwn(scheme, 'bearerAuth'))) continue
        expect(path).not.toMatch(/^\/api\/(auth|admin|public|webhooks|recordings|transcriptions)/)
        if (!path.startsWith('/api/')) continue
        const examplePath = path.replace(/\{[^}]+\}/g, 'resource-id')
        expect(
          classifyApiKeyRoute(examplePath, method.toUpperCase(), 'SUMMARY')
          ?? classifyApiKeyRoute(examplePath, method.toUpperCase(), 'TRANSCRIPT'),
          `${method.toUpperCase()} ${path} advertises bearer access without a matching policy`,
        ).not.toBeNull()
      }
    }
  })
})
