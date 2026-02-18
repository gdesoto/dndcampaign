import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignCharacterUpdateSchema } from '#shared/schemas/character'
import { requireCampaignPermission } from '#server/utils/campaign-auth'

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const characterId = event.context.params?.characterId
  if (!campaignId || !characterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign and character id are required')
  }
  const authz = await requireCampaignPermission(event, campaignId, 'content.write')
  if (!authz.ok) return authz.response

  const parsed = await readValidatedBodySafe(event, campaignCharacterUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid payload', parsed.fieldErrors)
  }

  const link = await prisma.campaignCharacter.findUnique({
    where: { campaignId_characterId: { campaignId, characterId } },
  })
  if (!link) {
    return fail(event, 404, 'NOT_FOUND', 'Character not linked to campaign')
  }

  const updated = await prisma.campaignCharacter.update({
    where: { id: link.id },
    data: {
      status: parsed.data.status ?? link.status,
      roleLabel: parsed.data.roleLabel ?? link.roleLabel,
      notes: parsed.data.notes ?? link.notes,
    },
  })
  return ok(updated)
})
