import { ok, fail } from '#server/utils/http'
import { readValidatedBodySafe } from '#server/utils/validate'
import { characterImportRequestSchema } from '#shared/schemas/character'
import { CharacterImportService } from '#server/services/character-import.service'

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
  const parsed = await readValidatedBodySafe(event, characterImportRequestSchema)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid import payload', parsed.fieldErrors)
  }

  if (parsed.data.provider !== 'DND_BEYOND') {
    return fail(400, 'VALIDATION_ERROR', 'Unsupported provider')
  }

  try {
    const character = await importService.createFromImport(
      session.user.id,
      parsed.data.externalId,
      {
        overwriteMode: parsed.data.overwriteMode,
        sections: parsed.data.sections,
      }
    )
    return ok(character)
  } catch (error) {
    const statusCode = getErrorStatusCode(error)
    const message = (error as Error).message || 'Import failed'
    if (statusCode === 403) {
      return fail(403, 'IMPORT_FORBIDDEN', message)
    }
    return fail(500, 'IMPORT_FAILED', message)
  }
})
