import { readBody } from 'h3'
import { z } from 'zod'
import { fail, ok } from '#server/utils/http'
import {
  dungeonExportSchema,
  dungeonGenerateSchema,
  dungeonRegenerateSchema,
  dungeonUpdateSchema,
} from '#shared/schemas/dungeon'
import { DungeonService } from '#server/services/dungeon/dungeon.service'
import { DungeonExportService } from '#server/services/dungeon/dungeon-export.service'

const dungeonService = new DungeonService()
const dungeonExportService = new DungeonExportService()

const dungeonPatchActionSchema = z.discriminatedUnion('action', [
  dungeonGenerateSchema.extend({ action: z.literal('generate') }),
  dungeonRegenerateSchema.extend({ action: z.literal('regenerate') }),
  z.object({ action: z.literal('publish') }),
  z.object({ action: z.literal('unpublish') }),
  dungeonExportSchema.extend({ action: z.literal('export') }),
])

const toFieldErrors = (issues: z.ZodIssue[]) => {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.join('.') || 'body'
    fieldErrors[key] = issue.message
  }
  return fieldErrors
}

export default defineEventHandler(async (event) => {
  const campaignId = event.context.params?.campaignId
  const dungeonId = event.context.params?.dungeonId
  if (!campaignId || !dungeonId) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Campaign id and dungeon id are required')
  }

  const rawBody = (await readBody(event)) ?? {}

  const sessionUser = await requireUserSession(event)

  const actionParsed = dungeonPatchActionSchema.safeParse(rawBody)
  if (actionParsed.success) {
    switch (actionParsed.data.action) {
      case 'generate': {
        const result = await dungeonService.generateDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        if (!result.ok) {
          return fail(event, result.statusCode, result.code, result.message, result.fields)
        }
        return ok(result.data)
      }
      case 'regenerate': {
        const result = await dungeonService.regenerateDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        if (!result.ok) {
          return fail(event, result.statusCode, result.code, result.message, result.fields)
        }
        return ok(result.data)
      }
      case 'publish': {
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          'READY'
        )
        if (!result.ok) {
          return fail(event, result.statusCode, result.code, result.message, result.fields)
        }
        return ok(result.data)
      }
      case 'unpublish': {
        const result = await dungeonService.setPublishStatus(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          'DRAFT'
        )
        if (!result.ok) {
          return fail(event, result.statusCode, result.code, result.message, result.fields)
        }
        return ok(result.data)
      }
      case 'export': {
        const result = await dungeonExportService.exportDungeon(
          campaignId,
          dungeonId,
          sessionUser.user.id,
          actionParsed.data
        )
        if (!result.ok) {
          return fail(event, result.statusCode, result.code, result.message, result.fields)
        }
        return ok(result.data)
      }
      default:
        break
    }
  }

  const parsed = dungeonUpdateSchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(event, 400, 'VALIDATION_ERROR', 'Invalid dungeon payload', toFieldErrors(parsed.error.issues))
  }

  const result = await dungeonService.updateDungeon(campaignId, dungeonId, sessionUser.user.id, parsed.data)
  if (!result.ok) {
    return fail(event, result.statusCode, result.code, result.message, result.fields)
  }

  return ok(result.data)
})
