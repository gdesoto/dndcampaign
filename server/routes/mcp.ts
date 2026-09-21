import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { getHeader, sendWebResponse, toWebRequest } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { AgentApiClient, createMcpServer } from '#server/services/mcp.service'
import { apiKeyService } from '#server/services/api-key.service'

const jsonError = (status: number, code: string, message: string) => new Response(JSON.stringify({ error: { code, message } }), {
  status,
  headers: {
    'content-type': 'application/json',
    ...(status === 401 ? { 'www-authenticate': 'Bearer' } : {}),
  },
})

export default defineEventHandler(async (event) => {
  try {
    const authorization = getHeader(event, 'authorization')
    const match = authorization ? /^Bearer\s+([^\s]+)$/i.exec(authorization) : null
    const secret = match?.[1]
    if (!secret) {
      return await sendWebResponse(event, jsonError(401, 'MCP_AUTH_REQUIRED', 'A bearer token is required for the MCP endpoint'))
    }

    const origin = getHeader(event, 'origin')
    if (origin) {
      const appUrl = useRuntimeConfig(event).public.appUrl
      if (!appUrl || origin !== new URL(appUrl).origin) {
        return await sendWebResponse(event, jsonError(403, 'MCP_ORIGIN_REJECTED', 'The MCP request Origin is not allowed'))
      }
    }

    if (!await apiKeyService.authenticate(secret)) {
      return await sendWebResponse(event, jsonError(401, 'UNAUTHORIZED', 'Invalid, expired, or revoked API key'))
    }

    // Each request owns its credentials and protocol state. REST enforces every tool's permissions.
    const server = createMcpServer(new AgentApiClient({ bearerToken: `Bearer ${secret}`, fetchImpl: useNitroApp().localFetch }))
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    try {
      await server.connect(transport)
      return await sendWebResponse(event, await transport.handleRequest(toWebRequest(event)))
    } finally {
      await server.close()
    }
  } catch (error) {
    console.error('[mcp] Request failed', error)
    return await sendWebResponse(event, jsonError(500, 'MCP_REQUEST_FAILED', 'Unable to process the MCP request'))
  }
})
