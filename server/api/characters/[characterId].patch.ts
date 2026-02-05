import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterUpdateSchema } from '#shared/schemas/character'
import { CharacterService } from '#server/services/character.service'

const characterService = new CharacterService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const parsed = await readValidatedBodySafe(event, characterUpdateSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid character payload', parsed.fieldErrors)
  }

  if (parsed.data.section && typeof parsed.data.payload !== 'undefined') {
    const updated = await characterService.updateCharacterSection(
      characterId,
      session.user.id,
      parsed.data.section,
      parsed.data.payload
    )
    if (!updated) {
      return fail(404, 'NOT_FOUND', 'Character not found')
    }
    return ok(updated)
  }

  const updated = await characterService.updateCharacterMeta(characterId, session.user.id, {
    name: parsed.data.name,
    status: parsed.data.status,
    portraitUrl: parsed.data.portraitUrl,
  })
  if (!updated) {
    return fail(404, 'NOT_FOUND', 'Character not found')
  }
  return ok(updated)
})
