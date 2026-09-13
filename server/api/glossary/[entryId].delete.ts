import { prisma } from '#server/db/prisma'
import { ok, apiError, routeParams } from '#server/utils/http'
import { buildCampaignWhereForPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { entryId } = routeParams(event, 'entryId')

  const existing = await prisma.glossaryEntry.findFirst({
    where: {
      id: entryId,
      campaign: buildCampaignWhereForPermission(session.user.id, 'content.write'),
    },
  })
  if (!existing) {
    throw apiError(404, 'NOT_FOUND', 'Glossary entry not found')
  }

  if (existing.type === 'PC') {
    await prisma.campaignCharacter.deleteMany({
      where: { glossaryEntryId: existing.id },
    })
  }

  await prisma.glossaryEntry.delete({ where: { id: entryId } })
  return ok({ success: true })
})

