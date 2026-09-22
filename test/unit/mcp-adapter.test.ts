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
  it.each(['advantage', 'disadvantage', 'invalid'])('validates and returns roll mode over MCP: %s', async (mode) => {
    const response = await handleMcpRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer dnd_test_secret', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'dice_roll', arguments: { notation: 'd20+5', mode } } }),
    }), { localFetch: async () => { throw new Error('Dice rolls must not call the campaign API') } })
    const body = await response.json() as { result: { isError?: boolean, content: Array<{ text: string }> } }
    if (mode === 'invalid') {
      expect(body.result.isError).toBe(true)
      return
    }
    expect(body.result.isError).not.toBe(true)
    const roll = JSON.parse(body.result.content[0]!.text) as { mode: string, rolls: number[], selectedRoll: number, modifier: number, total: number }
    expect(roll.mode).toBe(mode)
    expect(roll.rolls).toHaveLength(2)
    expect(roll.selectedRoll).toBe(mode === 'advantage' ? Math.max(...roll.rolls) : Math.min(...roll.rolls))
    expect(roll.modifier).toBe(5)
    expect(roll.total).toBe(roll.selectedRoll + 5)
  })

  it.each(['2d6+3-d4', '2d', '1d1', '101d6', 'd20+', 'd20++3', '9'.repeat(200), 'd'.repeat(201)])('rolls or rejects dice notation over MCP: %s', async (notation) => {
    const response = await handleMcpRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { authorization: 'Bearer dnd_test_secret', accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'dice_roll', arguments: { notation } } }),
    }), { localFetch: async () => { throw new Error('Dice rolls must not call the campaign API') } })
    const body = await response.json() as { result: { isError?: boolean, content: Array<{ text: string }> } }
    if (notation !== '2d6+3-d4') {
      expect(body.result.isError).toBe(true)
      return
    }
    expect(body.result.isError).not.toBe(true)
    const roll = JSON.parse(body.result.content[0]!.text) as { notation: string, mode: string, total: number, terms: Array<{ rolls?: number[], subtotal: number }> }
    expect(roll.mode).toBe('normal')
    expect(roll.notation).toBe(notation)
    expect(roll.terms[0]!.rolls).toHaveLength(2)
    for (const die of roll.terms[0]!.rolls!) {
      expect(Number.isInteger(die)).toBe(true)
      expect(die).toBeGreaterThanOrEqual(1)
      expect(die).toBeLessThanOrEqual(6)
    }
    expect(roll.terms[1]!.subtotal).toBe(3)
    expect(roll.terms[2]!.rolls).toHaveLength(1)
    expect(roll.terms[2]!.subtotal).toBe(-roll.terms[2]!.rolls![0]!)
    expect(roll.total).toBe(roll.terms.reduce((sum, term) => sum + term.subtotal, 0))
  })

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
    const listedBody = await listed.json() as { result?: { tools?: Array<{ name: string, description?: string }> } }
    expect(listedBody.result?.tools?.map((tool) => tool.name)).toContain('encounter_template_instantiate')
    expect(listedBody.result?.tools?.find((tool) => tool.name === 'dice_roll')?.description).toContain('Prefer this tool whenever performing dice rolls')

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
