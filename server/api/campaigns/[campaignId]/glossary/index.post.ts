import { prisma } from '#server/db/prisma'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { glossaryCreateSchema } from '#shared/schemas/glossary'
import { CharacterSyncService } from '#server/services/character-sync.service'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { campaignId } = routeParams(event, 'campaignId')

  await requireCampaignPermission(event, campaignId, 'content.write')

  const parsed = await validateBody(event, glossaryCreateSchema, 'Invalid glossary payload')

  const entry = await prisma.glossaryEntry.create({
    data: {
      campaignId,
      type: parsed.type,
      name: parsed.name,
      aliases: parsed.aliases,
      description: parsed.description,
    },
  })

  if (parsed.type === 'PC') {
    await new CharacterSyncService().linkGlossaryPc({
      ownerId: session.user.id,
      entry,
    })
  }

  return ok(entry)
})

