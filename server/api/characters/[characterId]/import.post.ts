import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterImportRequestSchema } from '#shared/schemas/character'
import { CharacterImportService } from '#server/services/character-import.service'
import { resolveCharacterAccess } from '#server/utils/character-auth'

const importService = new CharacterImportService()
const getErrorStatusCode = (error: unknown) => {
  const typedError = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
  }
  return typedError.statusCode || typedError.status || typedError.response?.status
}

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
    return fail(event, 403, 'FORBIDDEN', 'You do not have permission to import into this character')
  }

  const parsed = await readValidatedBodySafe(event, characterImportRequestSchema)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid import payload', parsed.fieldErrors)
  }

  if (parsed.data.provider !== 'DND_BEYOND') {
    return fail(event, 400, 'VALIDATION_ERROR', 'Unsupported provider')
  }

  try {
    const character = await importService.importIntoCharacter(
      characterId,
      session.user.id,
      parsed.data.externalId,
      {
        overwriteMode: parsed.data.overwriteMode,
        sections: parsed.data.sections,
      }
    )
    if (!character) {
      return fail(event, 404, 'NOT_FOUND', 'Character not found')
    }
    return ok(character)
  } catch (error) {
    const statusCode = getErrorStatusCode(error)
    const message = (error as Error).message || 'Import failed'
    if (statusCode === 403) {
      return fail(event, 403, 'IMPORT_FORBIDDEN', message)
    }
    return fail(event, 500, 'IMPORT_FAILED', message)
  }
})
