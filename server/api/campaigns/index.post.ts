import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { campaignCreateSchema } from '#shared/schemas/campaign'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await readValidatedBodySafe(event, campaignCreateSchema)

  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid campaign payload', parsed.fieldErrors)
  }

  const campaign = await prisma.campaign.create({
    data: {
      ownerId: session.user.id,
      name: parsed.data.name,
      system: parsed.data.system,
      description: parsed.data.description,
      members: {
        create: {
          userId: session.user.id,
          role: 'OWNER',
          invitedByUserId: session.user.id,
        },
      },
    },
  })

  return ok(campaign)
})

