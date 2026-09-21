import { describe, expect, it } from 'vitest'
import { AgentApiClient, createMcpServer } from '../../server/services/mcp.service'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { AgentApiError } from '../../server/services/mcp.service'

async function handleMcpRequest(request: Request, options: { localFetch: (input: string | URL, init?: RequestInit) => Promise<Response> }) {
  const server = createMcpServer(new AgentApiClient({ bearerToken: request.headers.get('authorization')!, fetchImpl: options.localFetch }))
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try { return await transport.handleRequest(request) } finally { await server.close() }
}

describe('MCP agent API adapter', () => {
  it('sends the configured bearer key and unwraps the API envelope', async () => {
    let request: { url: string, init?: RequestInit } | undefined
    const client = new AgentApiClient({

      bearerToken: 'Bearer dnd_test_secret',
      fetchImpl: async (url, init) => {
        request = { url: String(url), init }
        return new Response(JSON.stringify({ data: { id: 'campaign-1' }, error: null }), { status: 200 })
      },
    })

    await expect(client.request('/api/campaigns/campaign-1')).resolves.toEqual({ id: 'campaign-1' })
    expect(request?.init?.headers).toBeInstanceOf(Headers)
    expect((request?.init?.headers as Headers).get('authorization')).toBe('Bearer dnd_test_secret')
  })

  it('preserves API error code, message, status, and fields', async () => {
    const client = new AgentApiClient({

      bearerToken: 'Bearer dnd_test_secret',
      fetchImpl: async () => new Response(JSON.stringify({ data: null, error: { code: 'FORBIDDEN', message: 'Key is not scoped to this campaign', fields: { campaignId: 'denied' } } }), { status: 403 }),
    })

    await expect(client.request('/api/campaigns/denied')).rejects.toEqual(expect.objectContaining<Partial<AgentApiError>>({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Key is not scoped to this campaign',
      fields: { campaignId: 'denied' },
    }))
  })

  it('serializes transcript search parameters and exposes no credential input', async () => {
    let url = ''
    const server = createMcpServer(new AgentApiClient({

      bearerToken: 'Bearer dnd_test_secret',
      fetchImpl: async (input) => {
        url = String(input)
        return new Response(JSON.stringify({ data: { mode: 'search', versionId: 'v1', totalLines: 3, totalMatches: 1, totalResults: 1, matches: [] }, error: null }), { status: 200 })
      },
    }))
    const tools = (server as unknown as { _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }> })._registeredTools
    const names = Object.keys(tools)
    expect(names).toContain('transcript_read')
    expect(names).toContain('session_summary_get')
    expect(names).toContain('session_summary_update')
    expect(names).toContain('transcript_update')
    expect(names).not.toContain('http_request')
    await tools.transcript_read.handler({ sessionId: 'session-1', q: 'dragon knight', contextLines: 2, offset: 4, limit: 10 })
    expect(url).toContain('/api/sessions/session-1/transcript?')
    expect(url).toContain('q=dragon+knight')
    expect(url).toContain('contextLines=2')
    expect(url).toContain('offset=4')
    expect(url).not.toContain('DND_API_KEY')
  })

  it('uses typed lifecycle and encounter library payloads', async () => {
    const requests: string[] = []
    const server = createMcpServer(new AgentApiClient({

      bearerToken: 'Bearer dnd_test_secret',
      fetchImpl: async (input, init) => {
        requests.push(`${String(input)} ${init?.method ?? 'GET'} ${init?.body ?? ''}`)
        return new Response(JSON.stringify({ data: { ok: true }, error: null }), { status: 200 })
      },
    }))
    const tools = (server as unknown as { _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }> })._registeredTools
    await tools.encounter_update.handler({ encounterId: 'encounter-1', body: { action: 'start' } })
    await tools.encounter_stat_block_create.handler({ campaignId: 'campaign-1', body: { name: 'Goblin', statBlockJson: { hp: 7 } } })
    await tools.encounter_template_instantiate.handler({ templateId: 'template-1', body: {} })
    expect(requests[0]).toContain('/api/encounters/encounter-1 PATCH')
    expect(requests[0]).toContain('"action":"start"')
    expect(requests[1]).toContain('/api/campaigns/campaign-1/encounters/stat-blocks POST')
    expect(requests[2]).toContain('/api/encounters/templates/template-1/instantiate POST')
  })

  it('reads the live OpenAPI contract without sending the bearer key', async () => {
    let publicRequest: { url: string, headers?: Headers } | undefined
    const server = createMcpServer(new AgentApiClient({

      bearerToken: 'Bearer dnd_test_secret',
      fetchImpl: async (input, init) => {
        publicRequest = { url: String(input), headers: new Headers(init?.headers) }
        return new Response(JSON.stringify({ openapi: '3.1.0', paths: { '/api/example': { get: {} } } }), { status: 200 })
      },
    }))
    const tools = (server as unknown as { _registeredTools: Record<string, { handler: (input: unknown) => Promise<unknown> }> })._registeredTools
    const response = await tools.openapi_get.handler({})
    expect(publicRequest?.url).toContain('/openapi.json')
    expect(publicRequest?.headers?.has('authorization')).toBe(false)
    expect(JSON.stringify(response)).toContain('resourceUri')
  })

  it('completes initialize, tools/list, and tools/call over stateless HTTP', async () => {
    const initialized = await handleMcpRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer dnd_test_secret', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } }),
    }), {

      localFetch: async () => new Response(JSON.stringify({ data: { id: 'campaign-1' }, error: null }), { status: 200 }),
    })
    const initializedBody = await initialized.json() as { result?: { serverInfo?: { name?: string } } }
    expect(initializedBody.result?.serverInfo?.name).toBe('dndcampaign-agent')

    const listed = await handleMcpRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer dnd_test_secret', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    }), {

      localFetch: async () => new Response(JSON.stringify({ data: { id: 'campaign-1' }, error: null }), { status: 200 }),
    })
    const listedBody = await listed.json() as { result?: { tools?: Array<{ name: string }> } }
    expect(listedBody.result?.tools?.map((tool) => tool.name)).toContain('encounter_template_instantiate')

    const called = await handleMcpRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer dnd_test_secret', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'encounter_update', arguments: { encounterId: 'encounter-1', body: { action: 'start' } } } }),
    }), {

      localFetch: async (input, init) => {
        expect(String(input)).toBe('/api/encounters/encounter-1')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer dnd_test_secret')
        expect(init?.body).toBe(JSON.stringify({ action: 'start' }))
        return new Response(JSON.stringify({ data: { id: 'campaign-1' }, error: null }), { status: 200 })
      },
    })
    const calledBody = await called.json() as { result?: { content?: Array<{ text: string }> } }
    expect(calledBody.result?.content?.[0]?.text).toContain('campaign-1')
  })
})
