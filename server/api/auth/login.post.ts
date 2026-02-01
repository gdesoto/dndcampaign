//import { setUserSession, verifyPassword, hashPassword, passwordNeedsRehash } from '#auth-utils'
import { prisma } from '#server/db/prisma'
import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { loginSchema } from '#shared/schemas/auth'

export default defineEventHandler(async (event) => {
  const parsed = await readValidatedBodySafe(event, loginSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid login payload', parsed.fieldErrors)
  }

  const { email, password } = parsed.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) {
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  }

  const isValid = await verifyPassword(user.passwordHash, password)
  if (!isValid) {
    return fail(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
  }

  if (await passwordNeedsReHash(user.passwordHash)) {
    const newHash = await hashPassword(password)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    })
  }

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    loggedInAt: new Date(),
  })

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  })
})
