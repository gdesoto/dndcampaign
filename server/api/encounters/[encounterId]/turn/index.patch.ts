import { ok, routeParams } from '#server/utils/http'
import { validateBody } from '#server/utils/validate'
import { encounterTurnSchema } from '#shared/schemas/encounter'
import { EncounterRuntimeService } from '#server/services/encounter/encounter-runtime.service'
import { EncounterService } from '#server/services/encounter/encounter.service'
export default defineEventHandler(async (event) => {
  const { encounterId } = routeParams(event, 'encounterId')
  const input = await validateBody(event, encounterTurnSchema, 'Invalid turn payload')
  const user = await requireApiUserSession(event)
  const runtime = new EncounterRuntimeService()
  if (input.action === 'advance') await runtime.advanceTurn(encounterId, user.user.id)
  else if (input.action === 'rewind') await runtime.rewindTurn(encounterId, user.user.id)
  else await runtime.setActiveTurn(encounterId, user.user.id, input)
  return ok(await new EncounterService().getEncounter(encounterId, user.user.id))
})
