// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { getApiTestBaseUrl } from '../scripts/api-test-context.mjs'
import { createApiTestPrismaClient } from '../scripts/prisma-test-client'

const prisma = createApiTestPrismaClient()
const hash = new Hash(new Scrypt())
const baseUrl = getApiTestBaseUrl()
const email = 'api-key-crud@example.com'
const password = 'password123'

describe('API key management and isolation', () => {
  let userId = ''
  let campaignId = ''
  let foreignCampaignId = ''
  let foreignSessionId = ''
  let dmEncounterId = ''
  let ownSessionId = ''
  let cookie = ''
  let secret = ''
  let keyId = ''

  beforeAll(async () => {
    const user = await prisma.user.upsert({ where: { email }, update: { passwordHash: await hash.make(password), name: 'API Key User' }, create: { email, passwordHash: await hash.make(password), name: 'API Key User' } })
    userId = user.id
    const foreignOwner = await prisma.user.create({ data: { email: `api-key-owner-${Date.now()}@example.com`, passwordHash: await hash.make(password), name: 'Foreign Owner' } })
    const campaign = await prisma.campaign.create({ data: { ownerId: userId, name: 'API Key Campaign' } })
    campaignId = campaign.id
    ownSessionId = (await prisma.session.create({ data: { campaignId, title: 'Owned Session' } })).id
    const foreign = await prisma.campaign.create({ data: { ownerId: foreignOwner.id, name: 'Foreign Campaign', members: { create: { userId, role: 'COLLABORATOR', hasDmAccess: false, invitedByUserId: foreignOwner.id } } } })
    foreignCampaignId = foreign.id
    const session = await prisma.session.create({ data: { campaignId: foreignCampaignId, title: 'Foreign Session' } })
    foreignSessionId = session.id
    dmEncounterId = (await prisma.campaignEncounter.create({ data: { campaignId: foreignCampaignId, sessionId: foreignSessionId, name: 'DM Encounter', visibility: 'DM_ONLY', createdByUserId: userId } })).id
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    expect(login.status).toBe(200)
    cookie = login.headers.get('set-cookie') || ''
  })

  afterAll(async () => {
    if (campaignId) await prisma.campaign.delete({ where: { id: campaignId } }).catch(() => undefined)
    if (foreignCampaignId) await prisma.campaign.delete({ where: { id: foreignCampaignId } }).catch(() => undefined)
    await prisma.user.deleteMany({ where: { email: { startsWith: 'api-key-owner-' } } })
    await prisma.$disconnect()
  })

  it('creates hashed one-time secrets and omits the secret from list responses', async () => {
    const response = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Agent key', campaignIds: [campaignId], permissions: ['campaign.read'] }) })
    expect(response.status).toBe(200)
    const payload = await response.json()
    secret = payload.data.secret
    keyId = payload.data.key.id
    expect(secret).toMatch(/^dnd_/)
    expect(payload.data.key).not.toHaveProperty('secret')
    const stored = await prisma.apiKey.findUnique({ where: { id: keyId } })
    expect(stored?.keyHash).not.toBe(secret)
    const list = await fetch(`${baseUrl}/api/account/api-keys`, { headers: { cookie } })
    expect((await list.json()).data.keys[0]).not.toHaveProperty('secret')
  })

  it('enforces selected campaigns and revocation', async () => {
    const denied = await fetch(`${baseUrl}/api/sessions/${foreignSessionId}`, { headers: { authorization: `Bearer ${secret}` } })
    expect(denied.status).toBe(403)
    const revoked = await fetch(`${baseUrl}/api/account/api-keys/${keyId}`, { method: 'DELETE', headers: { cookie } })
    expect(revoked.status).toBe(200)
    const after = await fetch(`${baseUrl}/api/campaigns`, { headers: { authorization: `Bearer ${secret}` } })
    expect(after.status).toBe(401)
  })

  it('serves stateless MCP initialize, discovery, and a named REST-backed tool', async () => {
    const keyResponse = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'MCP protocol key', campaignIds: [campaignId], permissions: ['campaign.read'] }) })
    expect(keyResponse.status).toBe(200)
    const mcpKey = (await keyResponse.json()).data as { secret: string; key: { id: string } }
    const post = (body: unknown, headers: Record<string, string> = {}) => fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${mcpKey.secret}`, accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
    const initialized = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'api-test', version: '1.0.0' } } })
    expect(initialized.status).toBe(200)
    expect((await initialized.json()).result.serverInfo.name).toBe('dndcampaign-agent')
    const listed = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    expect(listed.status).toBe(200)
    expect((await listed.json()).result.tools.map((tool: { name: string }) => tool.name)).toContain('campaign_get')
    const called = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'campaign_get', arguments: { campaignId } } })
    expect(called.status).toBe(200)
    expect((await called.json()).result.content[0].text).toContain(campaignId)
    const campaigns = await post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'campaigns_list', arguments: {} } })
    const campaignList = JSON.parse((await campaigns.json()).result.content[0].text) as Array<{ id: string }>
    expect(campaignList.map(campaign => campaign.id)).toEqual([campaignId])
    const discovery = { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }
    expect((await post(discovery, { authorization: '', cookie })).status).toBe(401)
    expect((await post(discovery, { authorization: 'Bearer invalid' })).status).toBe(401)
    expect((await post(discovery, { origin: 'https://untrusted.example' })).status).toBe(403)
    const denied = await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'campaign_get', arguments: { campaignId: foreignCampaignId } } })
    expect((await denied.json()).result.isError).toBe(true)
    await prisma.apiKey.update({ where: { id: mcpKey.key.id }, data: { revokedAt: new Date() } })
    expect((await post(discovery)).status).toBe(401)
  })

  it('preserves DM-only encounter visibility for bearer keys', async () => {
    const response = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Encounter key', campaignIds: [foreignCampaignId], permissions: ['encounters.read'] }) })
    const encounterSecret = (await response.json()).data.secret
    expect((await fetch(`${baseUrl}/api/encounters/${dmEncounterId}`, { headers: { authorization: `Bearer ${encounterSecret}` } })).status).toBe(404)
    await prisma.campaignMember.update({ where: { campaignId_userId: { campaignId: foreignCampaignId, userId } }, data: { hasDmAccess: true } })
    expect((await fetch(`${baseUrl}/api/encounters/${dmEncounterId}`, { headers: { authorization: `Bearer ${encounterSecret}` } })).status).toBe(200)
    await prisma.campaignMember.update({ where: { campaignId_userId: { campaignId: foreignCampaignId, userId } }, data: { hasDmAccess: false } })
  })

  it('intersects issued keys with current membership and resource writes', async () => {
    const memberKeyResponse = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Member key', campaignIds: [foreignCampaignId], permissions: ['sessions.read'] }) })
    const memberSecret = (await memberKeyResponse.json()).data.secret
    await prisma.campaignMember.deleteMany({ where: { campaignId: foreignCampaignId, userId } })
    expect((await fetch(`${baseUrl}/api/sessions/${foreignSessionId}`, { headers: { authorization: `Bearer ${memberSecret}` } })).status).toBe(403)

    const readOnlyResponse = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Read key', campaignIds: [campaignId], permissions: ['sessions.read'] }) })
    const readOnlySecret = (await readOnlyResponse.json()).data.secret
    expect((await fetch(`${baseUrl}/api/sessions/${ownSessionId}`, { method: 'PATCH', headers: { authorization: `Bearer ${readOnlySecret}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Denied update' }) })).status).toBe(403)

    const writeResponse = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Write key', campaignIds: [campaignId], permissions: ['sessions.write'] }) })
    const writeSecret = (await writeResponse.json()).data.secret
    const updated = await fetch(`${baseUrl}/api/sessions/${ownSessionId}`, { method: 'PATCH', headers: { authorization: `Bearer ${writeSecret}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Updated by agent' }) })
    expect(updated.status).toBe(200)
  })

  it('keeps key management cookie-only and rejects expired keys', async () => {
    const active = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Active', campaignIds: [campaignId], permissions: ['campaign.read'] }) })
    const activeSecret = (await active.json()).data.secret
    const response = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { authorization: `Bearer ${activeSecret}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'invalid', campaignIds: [campaignId], permissions: ['campaign.read'] }) })
    expect(response.status).toBe(403)
    const created = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Expired', campaignIds: [campaignId], permissions: ['campaign.read'], expiresAt: new Date(Date.now() - 1000).toISOString() }) })
    const expiredSecret = (await created.json()).data.secret
    expect((await fetch(`${baseUrl}/api/campaigns`, { headers: { authorization: `Bearer ${expiredSecret}` } })).status).toBe(401)
  })

  it('does not allow document type scope confusion or untyped document listings', async () => {
    const response = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Transcript writer', campaignIds: [campaignId], permissions: ['transcripts.read', 'transcripts.write'] }) })
    const transcriptSecret = (await response.json()).data.secret
    const summaryBody = { type: 'SUMMARY', title: 'Summary through transcript key', content: 'blocked' }
    const summaryCreate = await fetch(`${baseUrl}/api/sessions/${ownSessionId}/documents?type=TRANSCRIPT`, { method: 'POST', headers: { authorization: `Bearer ${transcriptSecret}`, 'content-type': 'application/json' }, body: JSON.stringify(summaryBody) })
    expect(summaryCreate.status).toBe(403)
    const untypedList = await fetch(`${baseUrl}/api/sessions/${ownSessionId}/documents`, { headers: { authorization: `Bearer ${transcriptSecret}` } })
    expect(untypedList.status).toBe(403)
    const notesCreate = await fetch(`${baseUrl}/api/sessions/${ownSessionId}/documents`, { method: 'POST', headers: { authorization: `Bearer ${transcriptSecret}`, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'NOTES', title: 'Notes', content: 'blocked' }) })
    expect(notesCreate.status).toBe(403)
  })

  it('runs an encounter through MCP with campaign-scoped phase enforcement', async () => {
    const key = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Encounter workflow', campaignIds: [campaignId], permissions: ['encounters.read', 'encounters.write'] }) })
    expect(key.status).toBe(200)
    const token = (await key.json()).data.secret
    const call = async (name: string, args: Record<string, unknown>, failed = false) => {
      const response = await fetch(`${baseUrl}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/json, text/event-stream', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) })
      expect(response.status).toBe(200)
      const body = (await response.json()).result
      expect(Boolean(body.isError), `${name}: ${JSON.stringify(body.content)}`).toBe(failed)
      return JSON.parse(body.content[0].text)
    }
    const encounter = await call('encounter_create', { campaignId, body: { name: 'MCP phase encounter' } })
    const encounterId = encounter.id
    const added = await call('encounter_participant_add', { encounterId, body: { participants: [{ name: 'Hero', side: 'ALLY', maxHp: 20 }, { name: 'Guard', side: 'NEUTRAL', maxHp: 12 }] } })
    expect(added.combatants).toHaveLength(2)
    const unavailable = await call('encounter_turn', { encounterId, body: { action: 'advance' } }, true)
    expect(unavailable.error.code).toBe('ENCOUNTER_ACTION_UNAVAILABLE')
    await call('encounter_transition', { encounterId, body: { action: 'start' } })
    const effect = await call('encounter_participant_effect', { encounterId, body: { action: 'damage', participantIds: added.combatants.map((p: { id: string }) => p.id), amount: 2 } })
    expect(effect.status).toBe('ACTIVE')
    expect(effect.combatants.map((p: { currentHp: number }) => p.currentHp)).toEqual([18, 10])
    await call('encounter_transition', { encounterId, body: { action: 'complete' } })
    const reopened = await call('encounter_transition', { encounterId, body: { action: 'reopen' } })
    expect(reopened.status).toBe('PAUSED')
    expect(reopened.availableActions.turn.allowed).toBe(false)
    const foreignEncounter = await prisma.campaignEncounter.create({ data: { campaignId: foreignCampaignId, createdByUserId: userId, name: 'Foreign' } })
    const denied = await call('encounter_participant_effect', { encounterId: foreignEncounter.id, body: { action: 'damage', participantIds: [added.combatants[0].id], amount: 2 } }, true)
    expect(denied.error.status).toBe(403)
  })

  it('scopes encounter stat-block mutations to selected campaigns', async () => {
    const response = await fetch(`${baseUrl}/api/account/api-keys`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Encounter writer', campaignIds: [campaignId], permissions: ['encounters.write'] }) })
    const encounterSecret = (await response.json()).data.secret
    const body = { name: 'Goblin', statBlockJson: { armorClass: 15 } }
    const own = await fetch(`${baseUrl}/api/campaigns/${campaignId}/encounters/stat-blocks`, { method: 'POST', headers: { authorization: `Bearer ${encounterSecret}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect(own.status).toBe(200)
    const foreign = await fetch(`${baseUrl}/api/campaigns/${foreignCampaignId}/encounters/stat-blocks`, { method: 'POST', headers: { authorization: `Bearer ${encounterSecret}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect(foreign.status).toBe(403)
  })
})
