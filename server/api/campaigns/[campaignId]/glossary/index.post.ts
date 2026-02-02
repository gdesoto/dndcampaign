import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { glossaryCreateSchema } from '#shared/schemas/glossary'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaignId = event.context.params?.campaignId
  if (!campaignId) {
    return fail(400, 'VALIDATION_ERROR', 'Campaign id is required')
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: session.user.id },
  })
  if (!campaign) {
    return fail(404, 'NOT_FOUND', 'Campaign not found')
  }

  const parsed = await readValidatedBodySafe(event, glossaryCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid glossary payload', parsed.fieldErrors)
  }

  const entry = await prisma.glossaryEntry.create({
    data: {
      campaignId,
      type: parsed.data.type,
      name: parsed.data.name,
      aliases: parsed.data.aliases,
      description: parsed.data.description,
    },
  })

  return ok(entry)
})

