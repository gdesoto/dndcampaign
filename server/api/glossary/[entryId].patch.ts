import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { glossaryUpdateSchema } from '#shared/schemas/glossary'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const entryId = event.context.params?.entryId
  if (!entryId) {
    return fail(400, 'VALIDATION_ERROR', 'Entry id is required')
  }

  const parsed = await readValidatedBodySafe(event, glossaryUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary payload', parsed.fieldErrors)
  }

  const existing = await prisma.glossaryEntry.findFirst({
    where: {
      id: entryId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    return fail(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const updated = await prisma.glossaryEntry.update({
    where: { id: entryId },
    data: parsed.data,
  })

  if (updated.type === 'PC') {
    const syncService = new CharacterSyncService()
    await syncService.syncCharacterFromGlossary(updated.id, session.user.id)
  }

  return ok(updated)
})

