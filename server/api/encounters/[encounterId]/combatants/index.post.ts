import { z } from 'zod'
import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterCombatantCreateSchema, encounterParticipantsAddSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
export default defineEventHandler(async event => {
  const { encounterId } = routeParams(event, 'encounterId')
  const input = await validateBody(event, z.union([encounterParticipantsAddSchema, encounterCombatantCreateSchema.strict()]), 'Invalid participant payload')
  const user = await requireApiUserSession(event)
  const service = new EncounterService()
  if ('participants' in input) {
    await service.createCombatants(encounterId, user.user.id, input.participants)
    return ok(await service.getEncounter(encounterId, user.user.id))
  }
  return ok(await service.createCombatant(encounterId, user.user.id, input))
})
