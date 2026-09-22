import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { campaignUpdateSchema } from '../../shared/schemas/campaign'
import { campaignCharacterUpdateSchema } from '../../shared/schemas/character'
import { glossaryCreateSchema, glossaryUpdateSchema } from '../../shared/schemas/glossary'
import { questCreateSchema, questUpdateSchema } from '../../shared/schemas/quest'
import { sessionCreateSchema, sessionUpdateSchema } from '../../shared/schemas/session'
import {
  encounterConditionCreateSchema,
  encounterConditionUpdateSchema,
  encounterCombatantCreateSchema,
  encounterCombatantUpdateSchema,
  encounterCreateSchema,
  encounterEventNoteCreateSchema,
  encounterInitiativeReorderSchema,
  encounterInitiativeRollSchema,
  encounterSetActiveTurnSchema,
  encounterStatBlockCreateSchema,
  encounterStatBlockUpdateSchema,
  encounterTemplateCreateSchema,
  encounterTemplateInstantiateSchema,
  encounterTemplateUpdateSchema,
  encounterUpdateSchema,
} from '../../shared/schemas/encounter'
import { documentUpdateSchema } from '../../shared/schemas/document'
import { transcriptQuerySchema } from '../../shared/schemas/transcript'
import { rollDice } from '../../shared/utils/dice'

export type AgentFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

export class AgentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: unknown,
  ) {
    super(message)
    this.name = 'AgentApiError'
  }
}

export interface AgentApiClientOptions {
  bearerToken: string
  fetchImpl: AgentFetch
}

export class AgentApiClient {
  private readonly bearerToken: string
  private readonly fetchImpl: AgentFetch

  constructor(options: AgentApiClientOptions) {
    this.bearerToken = options.bearerToken
    this.fetchImpl = options.fetchImpl
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.bearerToken) {
      throw new AgentApiError(500, 'MCP_CONFIGURATION_ERROR', 'A bearer token is required for the MCP adapter')
    }

    const headers = new Headers(init.headers)
    headers.set('accept', 'application/json')
    headers.set('authorization', this.bearerToken)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

    const response = await this.fetchImpl(path, { ...init, headers })
    const text = await response.text()
    let payload: unknown = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }

    if (!response.ok) {
      const envelope = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
      throw new AgentApiError(
        response.status,
        typeof envelope?.code === 'string' ? envelope.code : `HTTP_${response.status}`,
        typeof envelope?.message === 'string' ? envelope.message : `API request failed with status ${response.status}`,
        envelope?.fields,
      )
    }

    return (isRecord(payload) && 'data' in payload ? payload.data : payload) as T
  }

  async requestPublic(path: string): Promise<Response> {
    const headers = new Headers({ accept: 'application/json' })
    return this.fetchImpl(path, { headers })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function result(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function failure(error: unknown) {
  const details = error instanceof AgentApiError
    ? { code: error.code, message: error.message, status: error.status, fields: error.fields }
    : { code: 'MCP_REQUEST_FAILED', message: error instanceof Error ? error.message : String(error) }
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error: details }) }], isError: true }
}

const id = z.string().min(1).max(200)
const characterCreate = z.object({ characterId: id.uuid() })
const encounterUpdate = z.union([encounterUpdateSchema.strict(), z.object({ action: z.enum(['start', 'pause', 'resume', 'complete', 'abandon', 'reset']) }).strict()])
const damageOrHeal = z.object({ operation: z.enum(['damage', 'heal']), amount: z.number().int().min(1).max(9999), note: z.string().max(500).optional() })
const initiative = z.union([z.object({ action: z.literal('roll') }).and(encounterInitiativeRollSchema), z.object({ action: z.literal('reorder') }).and(encounterInitiativeReorderSchema)])
const turn = z.union([z.object({ action: z.enum(['advance', 'rewind']) }), z.object({ action: z.literal('set-active') }).and(encounterSetActiveTurnSchema)])
const transcriptInputSchema = transcriptQuerySchema.extend({ sessionId: id })

export function createMcpServer(client: AgentApiClient) {
  const server = new McpServer({ name: 'dndcampaign-agent', version: '1.0.0' })
  const call = async <T>(fn: () => Promise<T>) => {
    try { return result(await fn()) } catch (error) { return failure(error) }
  }

  server.registerTool('dice_roll', {
    description: 'Roll dice using the DM Vault dice roller and return individual die results, signed subtotals, and the total. Prefer this tool whenever performing dice rolls instead of inventing results or coming up with your own random number. Supports notation such as d20, 2d6+3, or 2d6+3-d4 (1–100 dice per term, 2–1000 sides). Set mode to advantage or disadvantage for a single d20 with an optional integer modifier (for example d20+5). Returns both rolls, selectedRoll, modifier, and total, applying the modifier once. Normal mode is the default and returns all terms and their subtotals. Does not save rolls or change campaign state. Requires a valid API key but no campaign resource permission.',
    inputSchema: { notation: z.string().trim().min(1).max(200).describe('Dice expression using dice, integer modifiers, +, and -, for example 2d6+3.'), mode: z.enum(['normal', 'advantage', 'disadvantage']).default('normal').describe('Advantage selects the higher of two d20 rolls; disadvantage selects the lower. Requires a single d20 with an optional integer modifier.') },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, ({ notation, mode }) => call(async () => rollDice(notation, mode)))

  server.registerTool('campaigns_list', { description: 'List campaigns permitted by this key. Requires campaign.read.', inputSchema: {} }, () => call(() => client.request('/api/campaigns')))
  server.registerTool('campaign_get', { description: 'Read campaign details. Requires campaign.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}`)))
  server.registerTool('campaign_update', { description: 'Update campaign details. Requires campaign.write.', inputSchema: { campaignId: id, body: campaignUpdateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}`, { method: 'PATCH', body: JSON.stringify(body) })))

  server.registerTool('characters_list', { description: 'List campaign characters. Requires characters.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/characters`)))
  server.registerTool('characters_create', { description: 'Create or link a campaign character. Requires characters.write.', inputSchema: { campaignId: id, body: characterCreate } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/characters`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('character_update', { description: 'Update a campaign character link. Requires characters.write.', inputSchema: { campaignId: id, characterId: id, body: campaignCharacterUpdateSchema } }, ({ campaignId, characterId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('character_delete', { description: 'Unlink a character from a campaign. Requires characters.write.', inputSchema: { campaignId: id, characterId: id } }, ({ campaignId, characterId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/characters/${encodeURIComponent(characterId)}`, { method: 'DELETE' })))

  server.registerTool('glossary_list', { description: 'List campaign glossary entries. Requires glossary.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/glossary`)))
  server.registerTool('glossary_create', { description: 'Create a glossary entry. Requires glossary.write.', inputSchema: { campaignId: id, body: glossaryCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/glossary`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('glossary_update', { description: 'Update a glossary entry. Requires glossary.write.', inputSchema: { entryId: id, body: glossaryUpdateSchema } }, ({ entryId, body }) => call(() => client.request(`/api/glossary/${encodeURIComponent(entryId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('glossary_delete', { description: 'Delete a glossary entry. Requires glossary.write.', inputSchema: { entryId: id } }, ({ entryId }) => call(() => client.request(`/api/glossary/${encodeURIComponent(entryId)}`, { method: 'DELETE' })))

  server.registerTool('quests_list', { description: 'List campaign quests. Requires quests.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/quests`)))
  server.registerTool('quests_create', { description: 'Create a quest. Requires quests.write.', inputSchema: { campaignId: id, body: questCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/quests`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('quest_update', { description: 'Update a quest. Requires quests.write.', inputSchema: { questId: id, body: questUpdateSchema } }, ({ questId, body }) => call(() => client.request(`/api/quests/${encodeURIComponent(questId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('quest_delete', { description: 'Delete a quest. Requires quests.write.', inputSchema: { questId: id } }, ({ questId }) => call(() => client.request(`/api/quests/${encodeURIComponent(questId)}`, { method: 'DELETE' })))

  server.registerTool('sessions_list', { description: 'List campaign sessions. Requires sessions.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/sessions`)))
  server.registerTool('session_get', { description: 'Read session details. Requires sessions.read.', inputSchema: { sessionId: id } }, ({ sessionId }) => call(() => client.request(`/api/sessions/${encodeURIComponent(sessionId)}`)))
  server.registerTool('session_create', { description: 'Create a session. Requires sessions.write.', inputSchema: { campaignId: id, body: sessionCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/sessions`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('session_update', { description: 'Update session metadata. Requires sessions.write.', inputSchema: { sessionId: id, body: sessionUpdateSchema } }, ({ sessionId, body }) => call(() => client.request(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('session_summary_get', { description: 'Read the current session summary document. Requires summaries.read.', inputSchema: { sessionId: id } }, ({ sessionId }) => call(() => client.request(`/api/sessions/${encodeURIComponent(sessionId)}/documents?type=SUMMARY`)))
  server.registerTool('session_summary_update', { description: 'Edit a session summary document returned by session_summary_get. Requires summaries.write.', inputSchema: { documentId: id, body: documentUpdateSchema } }, ({ documentId, body }) => call(() => client.request(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'PATCH', body: JSON.stringify(body) })))

  server.registerTool('transcript_read', { description: 'Read or search a transcript. Omitted versionId always selects the latest transcript version. Requires transcripts.read.', inputSchema: transcriptInputSchema }, ({ sessionId, ...query }) => call(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value))
    return client.request(`/api/sessions/${encodeURIComponent(sessionId)}/transcript?${params}`)
  }))
  server.registerTool('transcript_update', { description: 'Edit the transcript documentId returned by transcript_read. Requires transcripts.write.', inputSchema: { documentId: id, body: documentUpdateSchema } }, ({ documentId, body }) => call(() => client.request(`/api/documents/${encodeURIComponent(documentId)}`, { method: 'PATCH', body: JSON.stringify(body) })))

  server.registerTool('encounters_list', { description: 'List campaign encounters. Requires encounters.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters`)))
  server.registerTool('encounter_create', { description: 'Create an encounter. Requires encounters.write.', inputSchema: { campaignId: id, body: encounterCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_stat_blocks_list', { description: 'List encounter stat blocks for a campaign. Requires encounters.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters/stat-blocks`)))
  server.registerTool('encounter_stat_block_create', { description: 'Create an encounter stat block. Requires encounters.write.', inputSchema: { campaignId: id, body: encounterStatBlockCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters/stat-blocks`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_stat_block_update', { description: 'Update an encounter stat block. Requires encounters.write.', inputSchema: { statBlockId: id, body: encounterStatBlockUpdateSchema } }, ({ statBlockId, body }) => call(() => client.request(`/api/encounters/stat-blocks/${encodeURIComponent(statBlockId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_stat_block_delete', { description: 'Delete an encounter stat block. Requires encounters.write.', inputSchema: { statBlockId: id } }, ({ statBlockId }) => call(() => client.request(`/api/encounters/stat-blocks/${encodeURIComponent(statBlockId)}`, { method: 'DELETE' })))
  server.registerTool('encounter_templates_list', { description: 'List encounter templates for a campaign. Requires encounters.read.', inputSchema: { campaignId: id } }, ({ campaignId }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters/templates`)))
  server.registerTool('encounter_template_create', { description: 'Create an encounter template. Requires encounters.write.', inputSchema: { campaignId: id, body: encounterTemplateCreateSchema } }, ({ campaignId, body }) => call(() => client.request(`/api/campaigns/${encodeURIComponent(campaignId)}/encounters/templates`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_template_update', { description: 'Update an encounter template. Requires encounters.write.', inputSchema: { templateId: id, body: encounterTemplateUpdateSchema } }, ({ templateId, body }) => call(() => client.request(`/api/encounters/templates/${encodeURIComponent(templateId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_template_delete', { description: 'Delete an encounter template. Requires encounters.write.', inputSchema: { templateId: id } }, ({ templateId }) => call(() => client.request(`/api/encounters/templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' })))
  server.registerTool('encounter_template_instantiate', { description: 'Instantiate an encounter template. Requires encounters.write.', inputSchema: { templateId: id, body: encounterTemplateInstantiateSchema } }, ({ templateId, body }) => call(() => client.request(`/api/encounters/templates/${encodeURIComponent(templateId)}/instantiate`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_get', { description: 'Read an encounter. Requires encounters.read.', inputSchema: { encounterId: id } }, ({ encounterId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}`)))
  server.registerTool('encounter_update', { description: 'Update an encounter or lifecycle state. Requires encounters.write.', inputSchema: { encounterId: id, body: encounterUpdate } }, ({ encounterId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_delete', { description: 'Delete an encounter. Requires encounters.write.', inputSchema: { encounterId: id } }, ({ encounterId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}`, { method: 'DELETE' })))
  server.registerTool('encounter_combatants_list', { description: 'List encounter combatants. Requires encounters.read.', inputSchema: { encounterId: id } }, ({ encounterId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants`)))
  server.registerTool('encounter_combatant_create', { description: 'Add a combatant. Requires encounters.write.', inputSchema: { encounterId: id, body: encounterCombatantCreateSchema } }, ({ encounterId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_combatant_update', { description: 'Update a combatant or apply damage/healing. Requires encounters.write.', inputSchema: { encounterId: id, combatantId: id, body: z.union([encounterCombatantUpdateSchema.strict(), damageOrHeal.strict()]) } }, ({ encounterId, combatantId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_combatant_delete', { description: 'Remove a combatant. Requires encounters.write.', inputSchema: { encounterId: id, combatantId: id } }, ({ encounterId, combatantId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}`, { method: 'DELETE' })))
  server.registerTool('encounter_initiative', { description: 'Roll or reorder initiative. Requires encounters.write.', inputSchema: { encounterId: id, body: initiative } }, ({ encounterId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/initiative`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_turn', { description: 'Advance, rewind, or set the active turn. Requires encounters.write.', inputSchema: { encounterId: id, body: turn } }, ({ encounterId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/turn`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_condition_create', { description: 'Add a condition to a combatant. Requires encounters.write.', inputSchema: { encounterId: id, combatantId: id, body: encounterConditionCreateSchema } }, ({ encounterId, combatantId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}/conditions`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_condition_update', { description: 'Update a combatant condition. Requires encounters.write.', inputSchema: { encounterId: id, combatantId: id, conditionId: id, body: encounterConditionUpdateSchema } }, ({ encounterId, combatantId, conditionId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}/conditions/${encodeURIComponent(conditionId)}`, { method: 'PATCH', body: JSON.stringify(body) })))
  server.registerTool('encounter_condition_delete', { description: 'Remove a combatant condition. Requires encounters.write.', inputSchema: { encounterId: id, combatantId: id, conditionId: id } }, ({ encounterId, combatantId, conditionId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/combatants/${encodeURIComponent(combatantId)}/conditions/${encodeURIComponent(conditionId)}`, { method: 'DELETE' })))
  server.registerTool('encounter_events_list', { description: 'List encounter events. Requires encounters.read.', inputSchema: { encounterId: id } }, ({ encounterId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/events`)))
  server.registerTool('encounter_event_note_create', { description: 'Add a note event to an encounter. Requires encounters.write.', inputSchema: { encounterId: id, body: encounterEventNoteCreateSchema } }, ({ encounterId, body }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/events/note`, { method: 'POST', body: JSON.stringify(body) })))
  server.registerTool('encounter_summary_get', { description: 'Read the encounter summary. Requires encounters.read.', inputSchema: { encounterId: id } }, ({ encounterId }) => call(() => client.request(`/api/encounters/${encodeURIComponent(encounterId)}/summary`)))

  const readOpenapi = async () => {
    const response = await client.requestPublic('/openapi.json')
    if (!response.ok) throw new AgentApiError(response.status, 'OPENAPI_UNAVAILABLE', `Unable to read the API contract (status ${response.status})`)
    return JSON.parse(await response.text()) as Record<string, unknown>
  }
  server.registerResource('openapi', 'dndcampaign://openapi', { title: 'DND Campaign API contract', description: 'Current API contract, including bearer authentication and agent operations.', mimeType: 'application/json' }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await readOpenapi()) }] }))
  server.registerTool('openapi_get', { description: 'Read the current OpenAPI contract, optionally selecting a path or component. Use the resource for the complete document.', inputSchema: { path: z.string().max(300).optional(), component: z.string().max(200).optional() } }, ({ path, component }) => call(async () => {
    const spec = await readOpenapi()
    if (path) return isRecord(spec.paths) && path in spec.paths ? spec.paths[path] : { error: 'Path not found', path }
    if (component) return isRecord(spec.components) && isRecord(spec.components.schemas) && component in spec.components.schemas ? spec.components.schemas[component] : { error: 'Schema not found', component }
    return { openapi: spec.openapi, info: spec.info, servers: spec.servers, tags: spec.tags, pathCount: isRecord(spec.paths) ? Object.keys(spec.paths).length : 0, resourceUri: 'dndcampaign://openapi' }
  }))

  return server
}
