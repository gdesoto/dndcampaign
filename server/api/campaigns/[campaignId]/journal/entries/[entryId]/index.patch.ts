import { z } from 'zod'
import { fail, respond } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import {
  campaignJournalDiscoverInputSchema,
  campaignJournalDiscoverableUpdateSchema,
  campaignJournalTransferInputSchema,
  campaignJournalUpdateSchema,
} from '#shared/schemas/campaign-journal'

const campaignJournalService = new CampaignJournalService()

const journalActionSchema = z.discriminatedUnion('action', [
  campaignJournalDiscoverableUpdateSchema.extend({ action: z.literal('discoverable') }),
  campaignJournalDiscoverInputSchema.extend({ action: z.literal('discover') }),
  campaignJournalTransferInputSchema.extend({ action: z.literal('transfer') }),
  z.object({ action: z.literal('archive') }),
  z.object({ action: z.literal('unarchive') }),
])

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const entryId = event.context.params?.entryId
  if (!campaignId || !entryId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and entry id are required')
  }

  const payload = (await readBody(event)) ?? {}
  const sessionUser = await requireUserSession(event)
  const userId = sessionUser.user.id
  const systemRole = sessionUser.user.systemRole
  const hasAction = typeof payload === 'object' && payload !== null && 'action' in payload

  if (!hasAction) {
    const parsed = validateInput(event, campaignJournalUpdateSchema, payload, 'Invalid journal update payload')
    if (!parsed.ok) return parsed.response
    return respond(event, await campaignJournalService.updateEntry(campaignId, entryId, userId, parsed.data, systemRole))
  }

  const parsed = validateInput(event, journalActionSchema, payload, 'Invalid journal action payload')
  if (!parsed.ok) return parsed.response

  const input = parsed.data
  switch (input.action) {
    case 'discoverable':
      return respond(event, await campaignJournalService.updateDiscoverable(campaignId, entryId, userId, input, systemRole))
    case 'discover':
      return respond(event, await campaignJournalService.discoverEntry(campaignId, entryId, userId, input, systemRole))
    case 'transfer':
      return respond(event, await campaignJournalService.transferEntry(campaignId, entryId, userId, input, systemRole))
    case 'archive':
    case 'unarchive':
      return respond(event, await campaignJournalService.archiveEntry(campaignId, entryId, userId, { archived: input.action === 'archive' }, systemRole))
  }
})
