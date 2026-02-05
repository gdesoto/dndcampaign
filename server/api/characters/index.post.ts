import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterCreateSchema } from '#shared/schemas/character'
import { CharacterService } from '#server/services/character.service'

const characterService = new CharacterService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = await readValidatedBodySafe(event, characterCreateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid character payload', parsed.fieldErrors)
  }

  const character = await characterService.createManualCharacter(
    session.user.id,
    parsed.data.name,
    parsed.data.sheetJson as Record<string, unknown> | undefined
  )
  return ok(character)
})
