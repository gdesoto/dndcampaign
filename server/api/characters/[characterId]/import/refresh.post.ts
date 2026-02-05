import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterImportRefreshSchema } from '#shared/schemas/character'
import { CharacterImportService } from '#server/services/character-import.service'

const importService = new CharacterImportService()

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const characterId = event.context.params?.characterId
  if (!characterId) {
    return fail(400, 'VALIDATION_ERROR', 'Character id is required')
  }

  const parsed = await readValidatedBodySafe(event, characterImportRefreshSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid refresh payload', parsed.fieldErrors)
  }

  try {
    const character = await importService.refreshImport(characterId, session.user.id, {
      overwriteMode: parsed.data.overwriteMode,
      sections: parsed.data.sections,
    })
    if (!character) {
      return fail(404, 'NOT_FOUND', 'No import history found for character')
    }
    return ok(character)
  } catch (error) {
    return fail(500, 'IMPORT_FAILED', (error as Error).message || 'Import refresh failed')
  }
})
