import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterEffectSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'
import { EncounterService } from '#server/services/encounter/encounter.service'
export default defineEventHandler(async event => {
  const { encounterId } = routeParams(event, 'encounterId')
  const input = await validateBody(event, encounterEffectSchema, 'Invalid participant effect')
  const user = await requireApiUserSession(event)
  await new EncounterRuntimeService().applyEffect(encounterId, user.user.id, input)
  return ok(await new EncounterService().getEncounter(encounterId, user.user.id))
})
