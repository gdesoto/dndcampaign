import { ok, apiError } from '#server/utils/http'
import { prisma } from '#server/db/prisma'
import { toAuthUserDto } from '#server/services/auth.service'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user) {
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      avatarUrl: true,
      isActive: true,
      deletedAt: true,
    },
  })

  if (!user || !user.isActive || user.deletedAt) {
    await clearUserSession(event)
    throw apiError(401, 'UNAUTHORIZED', 'Not authenticated')
  }

  return ok({ user: toAuthUserDto(user) })
})

