import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterInitiativeSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'
import { EncounterService } from '#server/services/encounter/encounter.service'
export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')
  const input = await validateBody(event, encounterInitiativeSchema, 'Invalid initiative payload')
  const user = await requireApiUserSession(event)
  const runtime = new EncounterRuntimeService()
  if (input.action === 'roll') await runtime.rollInitiative(encounterId, user.user.id, input)
  else if (input.action === 'clear') await runtime.clearInitiative(encounterId, user.user.id, input.combatantId)
  else await runtime.reorderInitiative(encounterId, user.user.id, input)
  return ok(await new EncounterService().getEncounter(encounterId, user.user.id))
})
