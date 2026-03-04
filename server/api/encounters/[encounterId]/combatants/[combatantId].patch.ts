import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { encounterCombatantUpdateSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export default defineEventHandler(async (event) => {
  const encounterId = event.context.params?.encounterId
  const combatantId = event.context.params?.combatantId
  if (!encounterId || !combatantId) return fail(event, 400, '', 'Encounter id and combatant id are required')

  const rawBody = (await readBody(event).catch(() => null)) as unknown
  if (isRecord(rawBody) && (rawBody.operation === 'damage' || rawBody.operation === 'heal')) {
    const amount = Number(rawBody.amount)
    const note = typeof rawBody.note === 'string' ? rawBody.note : undefined
    if (!Number.isInteger(amount) || amount < 1 || amount > 9999) {
      return fail(event, 400, '', 'Invalid amount payload', { amount: 'Must be an integer from 1 to 9999' })
    }

    const sessionUser = await requireUserSession(event)
    const runtimeService = new EncounterRuntimeService()
    const result = rawBody.operation === 'damage'
      ? await runtimeService.applyDamage(encounterId, combatantId, sessionUser.user.id, { amount, note })
      : await runtimeService.applyHeal(encounterId, combatantId, sessionUser.user.id, { amount, note })

    if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)
    return ok(result.data)
  }

  const parsed = await readValidatedBodySafe(event, encounterCombatantUpdateSchema)
  if (!parsed.success) return fail(event, 400, '', 'Invalid combatant payload', parsed.fieldErrors)

  const sessionUser = await requireUserSession(event)
  const result = await new EncounterService().updateCombatant(encounterId, combatantId, sessionUser.user.id, parsed.data)
  if (!result.ok) return fail(event, result.statusCode, result.code, result.message, result.fields)

  return ok(result.data)
})
