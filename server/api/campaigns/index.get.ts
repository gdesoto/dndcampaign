//import { requireUserSession } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const campaigns = await prisma.campaign.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
  })

  return ok(campaigns)
})
