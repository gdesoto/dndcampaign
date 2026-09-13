// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'

const prisma = createApiTestPrismaClient()
const baseUrl = getApiTestBaseUrl()
let cookie = ''
let webhookUrl = ''
let webhookResponse: unknown = null
let webhookStatus = 200
let webhookServer: Server

beforeAll(async () => {
  const password = 'dev-n8n-test-password'
  const passwordHash = await new Hash(new Scrypt()).make(password)
  const user = await prisma.user.create({
    data: { email: 'dev-n8n-test@example.com', name: 'Dev n8n Tester', passwordHash },
  })
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.22' },
    body: JSON.stringify({ email: user.email, password }),
  })
  expect(login.status).toBe(200)
  cookie = login.headers.get('set-cookie')?.match(/nuxt-session=[^;]+/)?.[0] || ''

  webhookServer = createServer((_request, response) => {
    response.statusCode = webhookStatus
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(webhookResponse))
  })
  await new Promise<void>((resolveListen) => webhookServer.listen(0, '127.0.0.1', resolveListen))
  const address = webhookServer.address()
  if (!address || typeof address === 'string') throw new Error('Unable to start local n8n mock')
  webhookUrl = `http://127.0.0.1:${address.port}`
}, 120_000)

afterAll(async () => {
  await new Promise<void>((resolveClose) => webhookServer.close(() => resolveClose()))
  await prisma.$disconnect()
})

const runN8nTest = () => fetch(`${baseUrl}/api/dev/n8n-test`, {
  method: 'POST',
  headers: { cookie, 'content-type': 'application/json' },
  body: JSON.stringify({ webhookUrlOverride: webhookUrl }),
})

it('accepts a schema-valid webhook response through the dev-only test endpoint', async () => {
  const validResponse = {
    trackingId: 'n8n-valid-response',
    status: 'COMPLETED',
    summaryContent: {
      fullSummary: 'A valid summary',
      keyMoments: ['A key moment'],
      highlights: ['Preserved raw response field'],
    },
    meta: { source: 'local-test' },
  }
  webhookResponse = validResponse

  const response = await runN8nTest()
  expect(response.status).toBe(200)
  const payload = await response.json()
  expect(payload.data).toEqual({
    valid: true,
    trackingId: expect.stringMatching(/^devtest_/),
    summaryContent: validResponse.summaryContent,
    suggestions: null,
    meta: validResponse.meta,
  })
})

it.each([
  [
    'a lowercase status',
    { trackingId: 'n8n-invalid-status', status: 'completed', summaryContent: 'Invalid status' },
    ['status'],
  ],
  [
    'a non-array suggestion list',
    { trackingId: 'n8n-invalid-suggestions', suggestions: { quests: 'not-an-array' } },
    ['suggestions', 'quests'],
  ],
  [
    'a non-string full summary',
    { trackingId: 'n8n-invalid-summary', summaryContent: { fullSummary: 1 } },
    ['summaryContent'],
  ],
  [
    'an empty summary string',
    { trackingId: 'n8n-empty-summary', summaryContent: '' },
    ['summaryContent'],
  ],
  [
    'an empty summary and suggestion payload',
    { trackingId: 'n8n-empty' },
    ['summaryContent'],
  ],
])('rejects %s with Zod issues', async (_label, invalidResponse, expectedPath) => {
  webhookResponse = invalidResponse

  const response = await runN8nTest()
  expect(response.status).toBe(400)
  const payload = await response.json()
  expect(payload.error.code).toBe('INVALID_RESPONSE')
  expect(payload.error.fields).toEqual({ issues: expect.any(String) })
  const issues = JSON.parse(payload.error.fields.issues)
  expect(issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path: expectedPath }),
  ]))
})

it('requires authentication before invoking the dev-only webhook test', async () => {
  const response = await fetch(`${baseUrl}/api/dev/n8n-test`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ webhookUrlOverride: webhookUrl }),
  })

  expect(response.status).toBe(401)
})

it('returns a route failure when the local webhook mock fails', async () => {
  webhookStatus = 503
  webhookResponse = { error: 'Local mock unavailable' }

  const response = await runN8nTest()
  expect(response.status).toBe(500)
  const payload = await response.json()
  expect(payload.error.code).toBe('N8N_TEST_FAILED')

  webhookStatus = 200
})
