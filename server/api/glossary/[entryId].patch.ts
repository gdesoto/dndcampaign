import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { glossaryUpdateSchema } from '#shared/schemas/glossary'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { entryId } = routeParams(event, 'entryId')

  const parsed = await validateBody(event, glossaryUpdateSchema, 'Invalid glossary payload')

  const existing = await prisma.glossaryEntry.findFirst({
    where: {
      id: entryId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  const updated = await prisma.glossaryEntry.update({
    where: { id: entryId },
    data: parsed,
  })

  if (updated.type === 'PC') {
    const syncService = new CharacterSyncService()
    await syncService.syncCharacterFromGlossary(updated.id, session.user.id)
  }

  return ok(updated)
})

