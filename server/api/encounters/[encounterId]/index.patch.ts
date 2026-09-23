import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterPatchSchema } from '#shared/schemas/encounter'
import { EncounterService } from '#server/services/encounter/encounter.service'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'

export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')
  const input = await validateBody(event, encounterPatchSchema, 'Invalid encounter payload')
  const user = await requireApiUserSession(event)
  const service = new EncounterService()
  if ('action' in input) await new EncounterRuntimeService().transitionStatus(encounterId, user.user.id, input.action)
  else await service.updateEncounter(encounterId, user.user.id, input)
  return ok(await service.getEncounter(encounterId, user.user.id))
})
