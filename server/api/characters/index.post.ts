import { readBody } from 'h3'
import { z } from 'zod'
import { ok, fail } from '#server/utils/http'
import { characterCreateSchema, characterImportRequestSchema } from '#shared/schemas/character'
import { CharacterService } from '#server/services/character.service'
import { CharacterImportService } from '#server/services/character-import.service'

const characterService = new CharacterService()
const importService = new CharacterImportService()

const characterCreateActionSchema = characterImportRequestSchema.extend({
  action: z.literal('import'),
})

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
  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = characterCreateActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.provider !== 'DND_BEYOND') {
      return fail(400, 'VALIDATION_ERROR', 'Unsupported provider')
    }

    try {
      const character = await importService.createFromImport(
        session.user.id,
        actionParsed.data.externalId,
        {
          overwriteMode: actionParsed.data.overwriteMode,
          sections: actionParsed.data.sections,
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
  }

  const parsed = characterCreateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(400, 'VALIDATION_ERROR', 'Invalid character payload')
  }

  const character = await characterService.createManualCharacter(
    session.user.id,
    parsed.data.name,
    parsed.data.sheetJson as Record<string, unknown> | undefined
  )
  return ok(character)
})
