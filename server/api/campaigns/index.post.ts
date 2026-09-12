import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { campaignCreateSchema } from '#shared/schemas/campaign'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await validateBody(event, campaignCreateSchema, 'Invalid campaign payload')

  if (!parsed.ok) return parsed.response

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

