import { readBody } from 'h3'
import { z } from 'zod'
import { ok, fail } from '#server/utils/http'
import {
  characterImportRefreshSchema,
  characterImportRequestSchema,
  characterUpdateSchema,
} from '#shared/schemas/character'
import { CharacterService } from '#server/services/character.service'
import { CharacterImportService } from '#server/services/character-import.service'
import { resolveCharacterAccess } from '#server/utils/character-auth'

const characterService = new CharacterService()
const importService = new CharacterImportService()

const characterPatchActionSchema = z.discriminatedUnion('action', [
  characterImportRequestSchema.extend({ action: z.literal('import') }),
  characterImportRefreshSchema.extend({ action: z.literal('refresh-import') }),
])

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
    return fail(event, 403, 'FORBIDDEN', 'You do not have permission to edit this character')
  }

  const rawBody = (await readBody(event)) ?? {}

  const actionParsed = characterPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    if (actionParsed.data.action === 'import') {
      if (actionParsed.data.provider !== 'DND_BEYOND') {
        return fail(event, 400, 'VALIDATION_ERROR', 'Unsupported provider')
      }
      try {
        const character = await importService.importIntoCharacter(
          characterId,
          session.user.id,
          actionParsed.data.externalId,
          {
            overwriteMode: actionParsed.data.overwriteMode,
            sections: actionParsed.data.sections,
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
    }

    try {
      const character = await importService.refreshImport(characterId, session.user.id, {
        overwriteMode: actionParsed.data.overwriteMode,
        sections: actionParsed.data.sections,
      })
      if (!character) {
        return fail(event, 404, 'NOT_FOUND', 'No import history found for character')
      }
      return ok(character)
    } catch (error) {
      const statusCode = getErrorStatusCode(error)
      const message = (error as Error).message || 'Import refresh failed'
      if (statusCode === 403) {
        return fail(event, 403, 'IMPORT_FORBIDDEN', message)
      }
      return fail(event, 500, 'IMPORT_FAILED', message)
    }
  }

  const parsed = characterUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid character payload')
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
