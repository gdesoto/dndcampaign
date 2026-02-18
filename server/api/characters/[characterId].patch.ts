import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterUpdateSchema } from '#shared/schemas/character'
import { CharacterService } from '#server/services/character.service'
import { resolveCharacterAccess } from '#server/utils/character-auth'

const characterService = new CharacterService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Character id is required')
  }
  const access = await resolveCharacterAccess(characterId, session.user.id, session.user.systemRole)
  if (!access.exists) {
    return fail(event, 404, 'NOT_FOUND', 'Character not found')
  }
  if (!access.canEdit) {
    return fail(event, 403, 'FORBIDDEN', 'You do not have permission to edit this character')
  }

  const parsed = await readValidatedBodySafe(event, characterUpdateSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid character payload', parsed.fieldErrors)
  }

  if (parsed.data.section && typeof parsed.data.payload !== 'undefined') {
    const updated = await characterService.updateCharacterSection(
      characterId,
      session.user.id,
      parsed.data.section,
      parsed.data.payload
    )
    if (!updated) {
      return fail(event, 404, 'NOT_FOUND', 'Character not found')
    }
    return ok(updated)
  }

  const updated = await characterService.updateCharacterMeta(characterId, session.user.id, {
    name: parsed.data.name,
    status: parsed.data.status,
    portraitUrl: parsed.data.portraitUrl,
  })
  if (!updated) {
    return fail(event, 404, 'NOT_FOUND', 'Character not found')
  }
  return ok(updated)
})
