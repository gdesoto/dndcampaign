import { getRuntimeConfigSnapshot } from '#server/services/runtime-config.service'
import { ok } from '#server/utils/http'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  if (!import.meta.dev) {
    return ok({ generatedAt: new Date().toISOString(), values: {} })
  }

  return ok(getRuntimeConfigSnapshot())
})
