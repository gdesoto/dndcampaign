import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterImportRequestSchema } from '#shared/schemas/character'
import { CharacterImportService } from '#server/services/character-import.service'

const importService = new CharacterImportService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const parsed = await readValidatedBodySafe(event, characterImportRequestSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid import payload', parsed.fieldErrors)
  }

  if (parsed.data.provider !== 'DND_BEYOND') {
    return fail(400, 'VALIDATION_ERROR', 'Unsupported provider')
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
      return fail(404, 'NOT_FOUND', 'Character not found')
    }
    return ok(character)
  } catch (error) {
    return fail(500, 'IMPORT_FAILED', (error as Error).message || 'Import failed')
  }
})
