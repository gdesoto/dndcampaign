import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { validateInput } from '#server/utils/validate'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'
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
  const { campaignId, entryId } = routeParams(event, 'campaignId', 'entryId')

  const payload = (await readBody(event)) ?? {}
  const { session, access } = await requireCampaignPermission(event, campaignId, 'campaign.read')
  const userId = session.user.id
  const hasAction = typeof payload === 'object' && payload !== null && 'action' in payload

  if (!hasAction) {
    const parsed = validateInput(campaignJournalUpdateSchema, payload, 'Invalid journal update payload')
    return ok(await campaignJournalService.updateEntry(access, entryId, userId, parsed))
  }

  const parsed = validateInput(journalActionSchema, payload, 'Invalid journal action payload')

  const input = parsed
  switch (input.action) {
    case 'discoverable':
      return ok(await campaignJournalService.updateDiscoverable(access, entryId, userId, input))
    case 'discover':
      return ok(await campaignJournalService.discoverEntry(access, entryId, userId, input))
    case 'transfer':
      return ok(await campaignJournalService.transferEntry(access, entryId, userId, input))
    case 'archive':
    case 'unarchive':
      return ok(await campaignJournalService.archiveEntry(access, entryId, userId, { archived: input.action === 'archive' }))
  }
})
