import { fail, ok } from '#server/utils/http'
import { CampaignJournalService } from '#server/services/campaign-journal.service'
import {
  campaignJournalArchiveInputSchema,
  campaignJournalDiscoverInputSchema,
  campaignJournalDiscoverableUpdateSchema,
  campaignJournalTransferInputSchema,
  campaignJournalUpdateSchema,
} from '#shared/schemas/campaign-journal'

const campaignJournalService = new CampaignJournalService()

type JournalPatchAction = 'discoverable' | 'discover' | 'transfer' | 'archive' | 'unarchive'

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toFieldErrorRecord = (fieldErrors: Record<string, string[] | undefined>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([key, messages]) => [key, messages?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  )

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const entryId = event.context.params?.entryId
  if (!campaignId || !entryId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and entry id are required')
  }

  const payload = await readBody(event)
  if (!isObjectRecord(payload)) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid journal update payload')
  }

  const rawAction = payload.action
  const action = typeof rawAction === 'string' ? (rawAction as JournalPatchAction) : null
  const sessionUser = await requireUserSession(event)

  if (!action) {
    const parsed = campaignJournalUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      return fail(
        event,
        400,
        'VALIDATION_ERROR',
        'Invalid journal update payload',
        toFieldErrorRecord(parsed.error.flatten().fieldErrors)
      )
    }

    const result = await campaignJournalService.updateEntry(
      campaignId,
      entryId,
      sessionUser.user.id,
      parsed.data,
      sessionUser.user.systemRole
    )
    if (!result.ok) {
      return fail(event, result.statusCode, result.code, result.message, result.fields)
    }
    return ok(result.data)
  }

  switch (action) {
    case 'discoverable': {
      const parsed = campaignJournalDiscoverableUpdateSchema.safeParse(payload)
      if (!parsed.success) {
        return fail(
          event,
          400,
          'VALIDATION_ERROR',
          'Invalid discoverable update payload',
          toFieldErrorRecord(parsed.error.flatten().fieldErrors)
        )
      }

      const result = await campaignJournalService.updateDiscoverable(
        campaignId,
        entryId,
        sessionUser.user.id,
        parsed.data,
        sessionUser.user.systemRole
      )
      if (!result.ok) {
        return fail(event, result.statusCode, result.code, result.message, result.fields)
      }
      return ok(result.data)
    }

    case 'discover': {
      const parsed = campaignJournalDiscoverInputSchema.safeParse(payload)
      if (!parsed.success) {
        return fail(
          event,
          400,
          'VALIDATION_ERROR',
          'Invalid discover payload',
          toFieldErrorRecord(parsed.error.flatten().fieldErrors)
        )
      }

      const result = await campaignJournalService.discoverEntry(
        campaignId,
        entryId,
        sessionUser.user.id,
        parsed.data,
        sessionUser.user.systemRole
      )
      if (!result.ok) {
        return fail(event, result.statusCode, result.code, result.message, result.fields)
      }
      return ok(result.data)
    }

    case 'transfer': {
      const parsed = campaignJournalTransferInputSchema.safeParse(payload)
      if (!parsed.success) {
        return fail(
          event,
          400,
          'VALIDATION_ERROR',
          'Invalid transfer payload',
          toFieldErrorRecord(parsed.error.flatten().fieldErrors)
        )
      }

      const result = await campaignJournalService.transferEntry(
        campaignId,
        entryId,
        sessionUser.user.id,
        parsed.data,
        sessionUser.user.systemRole
      )
      if (!result.ok) {
        return fail(event, result.statusCode, result.code, result.message, result.fields)
      }
      return ok(result.data)
    }

    case 'archive':
    case 'unarchive': {
      const parsed = campaignJournalArchiveInputSchema.safeParse({
        archived: action === 'archive',
      })
      if (!parsed.success) {
        return fail(
          event,
          400,
          'VALIDATION_ERROR',
          'Invalid archive payload',
          toFieldErrorRecord(parsed.error.flatten().fieldErrors)
        )
      }

      const result = await campaignJournalService.archiveEntry(
        campaignId,
        entryId,
        sessionUser.user.id,
        parsed.data,
        sessionUser.user.systemRole
      )
      if (!result.ok) {
        return fail(event, result.statusCode, result.code, result.message, result.fields)
      }
      return ok(result.data)
    }
  }

  return fail(event, 400, 'VALIDATION_ERROR', 'Unsupported journal action')
})
