import { expect, it } from 'vitest'
import { AgentApiClient, createMcpServer } from '../../server/services/mcp.service'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

const callTool = async (
  name: string,
  args: Record<string, unknown>,
  fetchImpl: (input: string | URL, init?: RequestInit) => Promise<Response>,
) => {
  const server = createMcpServer(new AgentApiClient({ bearerToken: 'Bearer dnd_test_secret', fetchImpl }))
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const response = await transport.handleRequest(new Request('http://vault.test/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    }))
    expect(response.status).toBe(200)
    return (await response.json()).result
  } finally {
    await server.close()
  }
}

it('rolls dice locally over MCP and reports invalid inputs', async () => {
  const noApi = async () => { throw new Error('Dice must not call the campaign API') }
  const result = await callTool('dice_roll', { notation: 'd20+5', mode: 'advantage' }, noApi)
  expect(result.isError).not.toBe(true)
  const roll = JSON.parse(result.content[0].text)
  expect(roll.mode).toBe('advantage')
  expect(roll.rolls).toHaveLength(2)
  expect(roll.selectedRoll).toBe(Math.max(...roll.rolls))
  expect(roll.total).toBe(roll.selectedRoll + 5)
  expect((await callTool('dice_roll', { notation: '2d' }, noApi)).isError).toBe(true)
  expect((await callTool('dice_roll', { notation: 'd20', mode: 'invalid' }, noApi)).isError).toBe(true)
})

it('serializes transcript queries with the configured credential and preserves API failures', async () => {
  const args = { sessionId: 'session-1', q: 'dragon & knight', contextLines: 2, offset: 4, limit: 10 }
  const result = await callTool('transcript_read', args, async (input, init) => {
    const url = new URL(String(input), 'http://vault.test')
    expect(url.pathname).toBe('/api/sessions/session-1/transcript')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ q: args.q, contextLines: '2', offset: '4', limit: '10' })
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer dnd_test_secret')
    return new Response(JSON.stringify({ data: { mode: 'search', totalMatches: 1 }, error: null }))
  })
  expect(JSON.parse(result.content[0].text)).toMatchObject({ mode: 'search', totalMatches: 1 })

  const denied = await callTool('transcript_read', args, async () => new Response(JSON.stringify({
    data: null, error: { code: 'FORBIDDEN', message: 'Campaign denied', fields: { campaignId: 'denied' } },
  }), { status: 403 }))
  expect(denied.isError).toBe(true)
  expect(JSON.parse(denied.content[0].text)).toMatchObject({
    error: { status: 403, code: 'FORBIDDEN', message: 'Campaign denied', fields: { campaignId: 'denied' } },
  })
})

it('reads the public OpenAPI contract without forwarding the bearer key', async () => {
  const result = await callTool('openapi_get', {}, async (input, init) => {
    expect(String(input)).toContain('/openapi.json')
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
    return new Response(JSON.stringify({ openapi: '3.1.0', paths: {} }))
  })
  expect(result.isError).not.toBe(true)
  expect(JSON.stringify(result)).toContain('resourceUri')
})
